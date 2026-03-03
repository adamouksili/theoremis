#!/usr/bin/env node

// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Benchmark Runner
// Measures precision/recall of hypothesis necessity detection
// against manually annotated ground truth.
// ─────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, extname } from 'path';
import { parseLatex, documentToIR } from '../src/parser/latex';
import { BUNDLES } from '../src/core/ir';
import type { Theorem } from '../src/core/ir';
import { runCounterexampleEngine, type CounterexampleResult } from '../src/engine/counterexample';

// ── Ground truth parsing ────────────────────────────────────

interface GroundTruth {
    // theorem name → hypothesis name → necessary
    hypotheses: Map<string, Map<string, boolean>>;
    // theorem name → mutation type → caught
    mutations: Map<string, Map<string, boolean>>;
}

/**
 * Normalize a theorem label to the same form the parser produces:
 * lowercase, non-alphanumeric → underscore.
 */
function normalizeLabel(label: string): string {
    return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Parse %! annotations from a .tex file.
 * Annotations appear AFTER the theorem they refer to.
 * Format:
 *   %! hypothesis <index> necessary|redundant   (0-based param index)
 *   %! mutation <type> caught|survives
 */
function parseAnnotations(latex: string): GroundTruth {
    const lines = latex.split('\n');
    const gt: GroundTruth = { hypotheses: new Map(), mutations: new Map() };

    let currentTheorem: string | null = null;

    for (const line of lines) {
        // Track which theorem we're annotating — use same normalization as IR
        const thmMatch = line.match(/\\begin\{(?:theorem|lemma)\}\[([^\]]+)\]/);
        if (thmMatch) {
            currentTheorem = normalizeLabel(thmMatch[1]);
        }

        if (!currentTheorem) continue;

        const annotMatch = line.match(/^%!\s+(\w+)\s+(.+)$/);
        if (!annotMatch) continue;

        const [, kind, rest] = annotMatch;

        if (kind === 'hypothesis') {
            const parts = rest.trim().split(/\s+/);
            const indexStr = parts[0]; // 0-based param index
            const necessity = parts[1] === 'necessary';
            if (!gt.hypotheses.has(currentTheorem)) gt.hypotheses.set(currentTheorem, new Map());
            gt.hypotheses.get(currentTheorem)!.set(indexStr, necessity);
        }

        if (kind === 'mutation') {
            const parts = rest.trim().split(/\s+/);
            const type = parts[0];
            const caught = parts[1] === 'caught';
            if (!gt.mutations.has(currentTheorem)) gt.mutations.set(currentTheorem, new Map());
            gt.mutations.get(currentTheorem)!.set(type, caught);
        }
    }

    return gt;
}

// ── Metrics ─────────────────────────────────────────────────

interface Metrics {
    truePositives: number;   // predicted necessary & is necessary
    falsePositives: number;  // predicted necessary & is redundant
    trueNegatives: number;   // predicted redundant & is redundant
    falseNegatives: number;  // predicted redundant & is necessary
    precision: number;
    recall: number;
    f1: number;
}

function computeMetrics(tp: number, fp: number, tn: number, fn: number): Metrics {
    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const f1 = (precision + recall) > 0 ? 2 * precision * recall / (precision + recall) : 0;
    return { truePositives: tp, falsePositives: fp, trueNegatives: tn, falseNegatives: fn, precision, recall, f1 };
}

// ── Runner ──────────────────────────────────────────────────

interface Confusion {
    tp: number;
    fp: number;
    tn: number;
    fn: number;
}

interface SuiteAccumulator {
    hypothesis: Confusion;
    mutation: Confusion;
    theoremsParsed: number;
    theoremsAnalyzed: number;
}

interface SuiteReport {
    version: number;
    suite: 'internal' | 'holdout';
    files: string[];
    theoremsParsed: number;
    theoremsAnalyzed: number;
    elapsedMs: number;
    hypothesisDetection: Metrics;
    mutationDetection: Metrics;
}

function zeroConfusion(): Confusion {
    return { tp: 0, fp: 0, tn: 0, fn: 0 };
}

function updateConfusion(conf: Confusion, predicted: boolean, actual: boolean): void {
    if (predicted && actual) conf.tp++;
    else if (predicted && !actual) conf.fp++;
    else if (!predicted && !actual) conf.tn++;
    else conf.fn++;
}

function mergeConfusion(a: Confusion, b: Confusion): Confusion {
    return {
        tp: a.tp + b.tp,
        fp: a.fp + b.fp,
        tn: a.tn + b.tn,
        fn: a.fn + b.fn,
    };
}

async function runSuite(
    suite: 'internal' | 'holdout',
    fixtureDir: string,
): Promise<SuiteReport> {
    const files = existsSync(fixtureDir)
        ? readdirSync(fixtureDir).filter(f => extname(f) === '.tex')
        : [];

    if (files.length === 0) {
        return {
            version: 1,
            suite,
            files: [],
            theoremsParsed: 0,
            theoremsAnalyzed: 0,
            elapsedMs: 0,
            hypothesisDetection: computeMetrics(0, 0, 0, 0),
            mutationDetection: computeMetrics(0, 0, 0, 0),
        };
    }

    const start = performance.now();
    const acc: SuiteAccumulator = {
        hypothesis: zeroConfusion(),
        mutation: zeroConfusion(),
        theoremsParsed: 0,
        theoremsAnalyzed: 0,
    };

    for (const file of files) {
        const filePath = resolve(fixtureDir, file);
        const latex = readFileSync(filePath, 'utf-8');
        const gt = parseAnnotations(latex);

        console.log(`  ── [${suite}] ${file} ──`);

        const bundle = BUNDLES.ClassicalMath;
        const doc = parseLatex(latex);
        const ir = documentToIR(doc, bundle);

        const theorems = ir.declarations.filter(
            (d): d is Theorem => d.tag === 'Theorem' || d.tag === 'Lemma',
        );
        acc.theoremsParsed += theorems.length;

        for (const thm of theorems) {
            acc.theoremsAnalyzed++;
            const nameKey = thm.name;
            const pathology = await runCounterexampleEngine(thm);

            const gtHyps = gt.hypotheses.get(nameKey);
            if (gtHyps) {
                const dropResults: CounterexampleResult[] = pathology.results.filter(
                    r => r.mutation.type === 'drop_hypothesis' && r.mutation.droppedParam,
                );

                for (let pi = 0; pi < dropResults.length; pi++) {
                    const result = dropResults[pi];
                    const actualNecessary = gtHyps.get(String(pi));
                    if (actualNecessary === undefined) continue;

                    const predictedNecessary = result.status === 'counterexample_found';
                    updateConfusion(acc.hypothesis, predictedNecessary, actualNecessary);

                    const icon = predictedNecessary === actualNecessary ? '✓' : '✗';
                    const paramName = result.mutation.droppedParam!;
                    console.log(
                        `    ${icon} ${thm.name} / ${paramName} [${pi}]: predicted=${predictedNecessary ? 'necessary' : 'redundant'}, actual=${actualNecessary ? 'necessary' : 'redundant'}`,
                    );
                }
            }

            const gtMuts = gt.mutations.get(nameKey);
            if (gtMuts) {
                for (const result of pathology.results) {
                    const gtCaught = gtMuts.get(result.mutation.type);
                    if (gtCaught === undefined) continue;

                    const predictedCaught = result.status === 'counterexample_found';
                    updateConfusion(acc.mutation, predictedCaught, gtCaught);
                }
            }
        }
    }

    const elapsedMs = Math.round(performance.now() - start);
    return {
        version: 1,
        suite,
        files: [...files].sort(),
        theoremsParsed: acc.theoremsParsed,
        theoremsAnalyzed: acc.theoremsAnalyzed,
        elapsedMs,
        hypothesisDetection: computeMetrics(
            acc.hypothesis.tp,
            acc.hypothesis.fp,
            acc.hypothesis.tn,
            acc.hypothesis.fn,
        ),
        mutationDetection: computeMetrics(
            acc.mutation.tp,
            acc.mutation.fp,
            acc.mutation.tn,
            acc.mutation.fn,
        ),
    };
}

async function runBenchmark(): Promise<void> {
    const baseFixtureDir = resolve(import.meta.dirname ?? '.', 'fixtures');
    const internalDir = resolve(baseFixtureDir, 'internal');
    const holdoutDir = resolve(baseFixtureDir, 'holdout');

    console.log('\n  Theoremis Hypothesis Linter — Benchmark');
    console.log('  ═══════════════════════════════════════\n');

    const internal = await runSuite('internal', internalDir);
    const holdout = await runSuite('holdout', holdoutDir);

    const aggHyp = mergeConfusion(
        {
            tp: internal.hypothesisDetection.truePositives,
            fp: internal.hypothesisDetection.falsePositives,
            tn: internal.hypothesisDetection.trueNegatives,
            fn: internal.hypothesisDetection.falseNegatives,
        },
        {
            tp: holdout.hypothesisDetection.truePositives,
            fp: holdout.hypothesisDetection.falsePositives,
            tn: holdout.hypothesisDetection.trueNegatives,
            fn: holdout.hypothesisDetection.falseNegatives,
        },
    );
    const aggMut = mergeConfusion(
        {
            tp: internal.mutationDetection.truePositives,
            fp: internal.mutationDetection.falsePositives,
            tn: internal.mutationDetection.trueNegatives,
            fn: internal.mutationDetection.falseNegatives,
        },
        {
            tp: holdout.mutationDetection.truePositives,
            fp: holdout.mutationDetection.falsePositives,
            tn: holdout.mutationDetection.trueNegatives,
            fn: holdout.mutationDetection.falseNegatives,
        },
    );

    const aggregate = {
        version: 1,
        theoremsParsed: internal.theoremsParsed + holdout.theoremsParsed,
        theoremsAnalyzed: internal.theoremsAnalyzed + holdout.theoremsAnalyzed,
        elapsedMs: internal.elapsedMs + holdout.elapsedMs,
        hypothesisDetection: computeMetrics(aggHyp.tp, aggHyp.fp, aggHyp.tn, aggHyp.fn),
        mutationDetection: computeMetrics(aggMut.tp, aggMut.fp, aggMut.tn, aggMut.fn),
    };

    console.log('\n  ═══════════════════════════════════════');
    console.log('  Results\n');
    console.log(`  Internal theorems analyzed: ${internal.theoremsAnalyzed}`);
    console.log(`  Holdout theorems analyzed:  ${holdout.theoremsAnalyzed}`);
    console.log(`  Aggregate analyzed:         ${aggregate.theoremsAnalyzed}`);
    console.log(`  Aggregate time:             ${(aggregate.elapsedMs / 1000).toFixed(2)}s\n`);

    console.log('  Aggregate Hypothesis Detection:');
    console.log(`    Precision: ${(aggregate.hypothesisDetection.precision * 100).toFixed(1)}%`);
    console.log(`    Recall:    ${(aggregate.hypothesisDetection.recall * 100).toFixed(1)}%`);
    console.log(`    F1:        ${(aggregate.hypothesisDetection.f1 * 100).toFixed(1)}%\n`);

    console.log('  Aggregate Mutation Detection:');
    console.log(`    Precision: ${(aggregate.mutationDetection.precision * 100).toFixed(1)}%`);
    console.log(`    Recall:    ${(aggregate.mutationDetection.recall * 100).toFixed(1)}%`);
    console.log(`    F1:        ${(aggregate.mutationDetection.f1 * 100).toFixed(1)}%\n`);

    const report = {
        version: 2,
        timestamp: new Date().toISOString(),
        benchmark: {
            internal,
            holdout,
            aggregate,
        },
    };

    console.log('  JSON:');
    console.log('  ' + JSON.stringify(report));
    console.log('');
}

runBenchmark().catch(err => {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
});
