#!/usr/bin/env node

// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Benchmark Runner
// Measures precision/recall of hypothesis necessity detection
// against manually annotated ground truth.
// ─────────────────────────────────────────────────────────────

import { readFileSync, readdirSync } from 'fs';
import { resolve, extname, relative } from 'path';
import { parseLatex, documentToIR } from '../src/parser/latex';
import { BUNDLES } from '../src/core/ir';
import type { Theorem } from '../src/core/ir';
import { runCounterexampleEngine, type CounterexampleResult } from '../src/engine/counterexample';
import { quickCheck, extractVariables } from '../src/engine/evaluator';

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

async function runBenchmark(): Promise<void> {
    const fixtureDir = resolve(import.meta.dirname ?? '.', 'fixtures');
    const files = readdirSync(fixtureDir).filter(f => extname(f) === '.tex');

    if (files.length === 0) {
        console.error('No .tex fixtures found in bench/fixtures/');
        process.exit(1);
    }

    console.log('\n  Theoremis Hypothesis Linter — Benchmark');
    console.log('  ═══════════════════════════════════════\n');

    let totalTP = 0, totalFP = 0, totalTN = 0, totalFN = 0;
    let mutTP = 0, mutFP = 0, mutTN = 0, mutFN = 0;
    let theoremsAnalyzed = 0;
    let theoremsParsed = 0;
    const startTime = performance.now();

    for (const file of files) {
        const filePath = resolve(fixtureDir, file);
        const latex = readFileSync(filePath, 'utf-8');
        const gt = parseAnnotations(latex);

        console.log(`  ── ${file} ──`);

        const bundle = BUNDLES['ClassicalMath'];
        const doc = parseLatex(latex);
        const ir = documentToIR(doc, bundle);

        const theorems = ir.declarations.filter(
            (d): d is Theorem => d.tag === 'Theorem' || d.tag === 'Lemma',
        );

        theoremsParsed += theorems.length;

        for (const thm of theorems) {
            theoremsAnalyzed++;
            const nameKey = thm.name;

            // Run analysis
            const pathology = await runCounterexampleEngine(thm);

            // ── Hypothesis necessity evaluation ─────────
            const gtHyps = gt.hypotheses.get(nameKey);
            if (gtHyps) {
                // Build a map: param index → drop_hypothesis result
                const dropResults: CounterexampleResult[] = pathology.results.filter(
                    r => r.mutation.type === 'drop_hypothesis' && r.mutation.droppedParam,
                );

                for (let pi = 0; pi < dropResults.length; pi++) {
                    const result = dropResults[pi];
                    const paramName = result.mutation.droppedParam!;
                    const predictedNecessary = result.status === 'counterexample_found';

                    // Match by index (annotation uses 0-based index)
                    const actualNecessary = gtHyps.get(String(pi));

                    if (actualNecessary !== undefined) {
                        if (predictedNecessary && actualNecessary) { totalTP++; }
                        else if (predictedNecessary && !actualNecessary) { totalFP++; }
                        else if (!predictedNecessary && !actualNecessary) { totalTN++; }
                        else if (!predictedNecessary && actualNecessary) { totalFN++; }

                        const icon = (predictedNecessary === actualNecessary) ? '✓' : '✗';
                        console.log(`    ${icon} ${thm.name} / ${paramName} [${pi}]: predicted=${predictedNecessary ? 'necessary' : 'redundant'}, actual=${actualNecessary ? 'necessary' : 'redundant'}`);
                    }
                }
            }

            // ── Mutation evaluation ─────────────────────
            const gtMuts = gt.mutations.get(nameKey);
            if (gtMuts) {
                for (const result of pathology.results) {
                    const mutType = result.mutation.type;
                    const gtCaught = gtMuts.get(mutType);
                    if (gtCaught === undefined) continue;

                    const predictedCaught = result.status === 'counterexample_found';
                    if (predictedCaught && gtCaught) { mutTP++; }
                    else if (predictedCaught && !gtCaught) { mutFP++; }
                    else if (!predictedCaught && !gtCaught) { mutTN++; }
                    else if (!predictedCaught && gtCaught) { mutFN++; }
                }
            }
        }
    }

    const elapsed = performance.now() - startTime;

    // ── Results ─────────────────────────────────────────
    const hypMetrics = computeMetrics(totalTP, totalFP, totalTN, totalFN);
    const mutMetrics = computeMetrics(mutTP, mutFP, mutTN, mutFN);

    console.log('\n  ═══════════════════════════════════════');
    console.log('  Results\n');

    console.log(`  Theorems parsed:    ${theoremsParsed}`);
    console.log(`  Theorems analyzed:  ${theoremsAnalyzed}`);
    console.log(`  Time:               ${(elapsed / 1000).toFixed(2)}s\n`);

    console.log('  Hypothesis Necessity Detection:');
    console.log(`    True Positives:   ${hypMetrics.truePositives}`);
    console.log(`    False Positives:  ${hypMetrics.falsePositives}`);
    console.log(`    True Negatives:   ${hypMetrics.trueNegatives}`);
    console.log(`    False Negatives:  ${hypMetrics.falseNegatives}`);
    console.log(`    Precision:        ${(hypMetrics.precision * 100).toFixed(1)}%`);
    console.log(`    Recall:           ${(hypMetrics.recall * 100).toFixed(1)}%`);
    console.log(`    F1:               ${(hypMetrics.f1 * 100).toFixed(1)}%\n`);

    console.log('  Mutation Detection:');
    console.log(`    True Positives:   ${mutMetrics.truePositives}`);
    console.log(`    False Positives:  ${mutMetrics.falsePositives}`);
    console.log(`    True Negatives:   ${mutMetrics.trueNegatives}`);
    console.log(`    False Negatives:  ${mutMetrics.falseNegatives}`);
    console.log(`    Precision:        ${(mutMetrics.precision * 100).toFixed(1)}%`);
    console.log(`    Recall:           ${(mutMetrics.recall * 100).toFixed(1)}%`);
    console.log(`    F1:               ${(mutMetrics.f1 * 100).toFixed(1)}%\n`);

    // JSON output for CI
    const report = {
        timestamp: new Date().toISOString(),
        theoremsParsed,
        theoremsAnalyzed,
        elapsedMs: Math.round(elapsed),
        hypothesisDetection: hypMetrics,
        mutationDetection: mutMetrics,
    };

    console.log('  JSON:');
    console.log('  ' + JSON.stringify(report));
    console.log('');
}

runBenchmark().catch(err => {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
});
