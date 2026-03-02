#!/usr/bin/env node

// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Hypothesis Linter
// Mutation-based analysis of theorem hypothesis necessity
// ─────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, extname, relative } from 'path';
import { parseLatex, documentToIR } from '../src/parser/latex';
import { BUNDLES } from '../src/core/ir';
import type { AxiomBundle, Theorem, IRModule } from '../src/core/ir';
import { runCounterexampleEngine, formatReport } from '../src/engine/counterexample';
import { quickCheck, extractVariables } from '../src/engine/evaluator';

// ── Options ─────────────────────────────────────────────────

interface Options {
    files: string[];
    bundle: string;
    format: 'text' | 'json' | 'github';
    numTests: number;
    verbose: boolean;
}

function parseArgs(argv: string[]): Options {
    const opts: Options = {
        files: [],
        bundle: 'ClassicalMath',
        format: 'text',
        numTests: 500,
        verbose: false,
    };

    let i = 2; // skip node + script
    while (i < argv.length) {
        const arg = argv[i];
        if (arg === '--bundle' || arg === '-b') { opts.bundle = argv[++i]; }
        else if (arg === '--format' || arg === '-f') { opts.format = argv[++i] as Options['format']; }
        else if (arg === '--tests' || arg === '-t') { opts.numTests = parseInt(argv[++i], 10); }
        else if (arg === '--verbose' || arg === '-v') { opts.verbose = true; }
        else if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0); }
        else if (!arg.startsWith('-')) { opts.files.push(arg); }
        i++;
    }

    return opts;
}

function printHelp(): void {
    console.log(`
  theoremis lint [options] [files...]

  Analyze LaTeX theorems for hypothesis necessity via mutation testing.

  Options:
    -b, --bundle <name>   Axiom bundle (default: ClassicalMath)
    -f, --format <fmt>    Output: text | json | github (default: text)
    -t, --tests <n>       QuickCheck tests per mutation (default: 500)
    -v, --verbose         Show detailed mutation results
    -h, --help            Show this help

  Examples:
    theoremis lint paper.tex
    theoremis lint --bundle NumberTheory --tests 1000 *.tex
    theoremis lint --format json src/theorems/
`);
}

// ── File discovery ──────────────────────────────────────────

function discoverFiles(paths: string[]): string[] {
    const result: string[] = [];
    for (const p of paths) {
        const abs = resolve(p);
        try {
            const stat = statSync(abs);
            if (stat.isFile() && extname(abs) === '.tex') {
                result.push(abs);
            } else if (stat.isDirectory()) {
                walkDir(abs, result);
            }
        } catch {
            console.error(`  ✗ Not found: ${p}`);
        }
    }
    return result;
}

function walkDir(dir: string, out: string[]): void {
    for (const entry of readdirSync(dir)) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        const full = resolve(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) walkDir(full, out);
        else if (extname(full) === '.tex') out.push(full);
    }
}

// ── Analysis ────────────────────────────────────────────────

interface TheoremReport {
    name: string;
    file: string;
    hypotheses: HypothesisResult[];
    quickCheck: { passed: number; failed: number; classification: string };
    mutations: MutationResult[];
}

interface HypothesisResult {
    name: string;
    necessary: boolean;
    confidence: number;
    evidence: string;
}

interface MutationResult {
    type: string;
    description: string;
    counterexampleFound: boolean;
    confidence: number;
    testsRun: number;
    witness?: string;
}

async function analyzeFile(
    filePath: string,
    bundle: AxiomBundle,
    numTests: number,
): Promise<TheoremReport[]> {
    const latex = readFileSync(filePath, 'utf-8');
    const doc = parseLatex(latex);
    const ir = documentToIR(doc, bundle);
    const reports: TheoremReport[] = [];

    const theorems = ir.declarations.filter(
        (d): d is Theorem => d.tag === 'Theorem' || d.tag === 'Lemma',
    );

    for (const thm of theorems) {
        // QuickCheck the original statement
        const vars = extractVariables(thm.statement);
        const qc = quickCheck(thm.statement, vars, numTests, thm.params);

        // Run mutation engine
        const pathology = await runCounterexampleEngine(thm);

        // Extract hypothesis necessity from drop_hypothesis mutations
        const hypotheses: HypothesisResult[] = [];
        for (const result of pathology.results) {
            if (result.mutation.type === 'drop_hypothesis' && result.mutation.droppedParam) {
                hypotheses.push({
                    name: result.mutation.droppedParam,
                    necessary: result.status === 'counterexample_found',
                    confidence: result.confidence,
                    evidence: result.witness?.description ?? (result.status === 'no_counterexample'
                        ? `No counterexample in ${result.testsRun} tests — may be removable`
                        : `Could not evaluate`),
                });
            }
        }

        // Collect all mutation results
        const mutations: MutationResult[] = pathology.results.map(r => ({
            type: r.mutation.type,
            description: r.mutation.description,
            counterexampleFound: r.status === 'counterexample_found',
            confidence: r.confidence,
            testsRun: r.testsRun,
            witness: r.witness?.description,
        }));

        reports.push({
            name: thm.name,
            file: filePath,
            hypotheses,
            quickCheck: {
                passed: qc.passed,
                failed: qc.failed,
                classification: qc.classification,
            },
            mutations,
        });
    }

    return reports;
}

// ── Formatters ──────────────────────────────────────────────

function formatText(reports: TheoremReport[], verbose: boolean): string {
    if (reports.length === 0) return '  No theorems found.\n';

    const lines: string[] = [];

    for (const r of reports) {
        const relFile = relative(process.cwd(), r.file);
        lines.push(`\n  ┌─ ${r.name} (${relFile})`);

        // QuickCheck summary
        const qcIcon = r.quickCheck.classification === 'verified' || r.quickCheck.classification === 'likely_true' ? '✓' : '?';
        lines.push(`  │  QuickCheck: ${qcIcon} ${r.quickCheck.passed} passed, ${r.quickCheck.failed} failed → ${r.quickCheck.classification}`);

        // Hypothesis analysis
        if (r.hypotheses.length > 0) {
            lines.push(`  │`);
            lines.push(`  │  Hypotheses:`);
            for (const h of r.hypotheses) {
                const icon = h.necessary ? '✓ necessary' : '⚠ possibly redundant';
                const conf = `${(h.confidence * 100).toFixed(0)}%`;
                lines.push(`  │    ${h.necessary ? '●' : '○'} ${h.name}: ${icon} (${conf} confidence)`);
                if (!h.necessary) {
                    lines.push(`  │      └─ ${h.evidence}`);
                }
            }
        }

        // Mutation summary
        const ceCount = r.mutations.filter(m => m.counterexampleFound).length;
        const safeCount = r.mutations.filter(m => !m.counterexampleFound).length;
        lines.push(`  │`);
        lines.push(`  │  Mutations: ${r.mutations.length} tested, ${ceCount} caught, ${safeCount} survived`);

        if (verbose) {
            for (const m of r.mutations) {
                const icon = m.counterexampleFound ? '✗' : '✓';
                lines.push(`  │    ${icon} ${m.description} (${m.testsRun} tests, ${(m.confidence * 100).toFixed(0)}%)`);
                if (m.witness) {
                    lines.push(`  │      └─ ${m.witness}`);
                }
            }
        }

        // Warnings
        const redundant = r.hypotheses.filter(h => !h.necessary);
        if (redundant.length > 0) {
            lines.push(`  │`);
            lines.push(`  │  ⚠ ${redundant.length} hypothesis(es) may be unnecessary:`);
            for (const h of redundant) {
                lines.push(`  │    → Consider removing "${h.name}" or weakening the constraint`);
            }
        }

        const survivedMutations = r.mutations.filter(m => !m.counterexampleFound && m.type !== 'negate_conclusion');
        if (survivedMutations.length > 0 && verbose) {
            lines.push(`  │`);
            lines.push(`  │  ℹ ${survivedMutations.length} mutation(s) survived — theorem may be strengthened:`);
            for (const m of survivedMutations) {
                lines.push(`  │    → ${m.description}`);
            }
        }

        lines.push(`  └─`);
    }

    return lines.join('\n');
}

function formatJSON(reports: TheoremReport[]): string {
    return JSON.stringify({
        tool: 'theoremis',
        version: '0.2.0',
        timestamp: new Date().toISOString(),
        theorems: reports.length,
        results: reports,
    }, null, 2);
}

function formatGitHub(reports: TheoremReport[]): string {
    const lines: string[] = [];
    for (const r of reports) {
        const relFile = relative(process.cwd(), r.file);
        for (const h of r.hypotheses) {
            if (!h.necessary) {
                lines.push(`::warning file=${relFile},title=Possibly redundant hypothesis::Hypothesis "${h.name}" in theorem "${r.name}" may be unnecessary (${(h.confidence * 100).toFixed(0)}% confidence). ${h.evidence}`);
            }
        }
        if (r.quickCheck.classification === 'falsified' || r.quickCheck.classification === 'likely_false') {
            lines.push(`::error file=${relFile},title=Theorem may be false::Theorem "${r.name}" — QuickCheck: ${r.quickCheck.failed} failures in ${r.quickCheck.passed + r.quickCheck.failed} tests`);
        }
    }
    return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
    const opts = parseArgs(process.argv);

    if (opts.files.length === 0) {
        opts.files = ['.'];
    }

    const files = discoverFiles(opts.files);
    if (files.length === 0) {
        console.error('  No .tex files found.');
        process.exit(2);
    }

    const bundle = BUNDLES[opts.bundle] ?? BUNDLES['ClassicalMath'];
    const allReports: TheoremReport[] = [];

    console.error(`\n  Theoremis Hypothesis Linter`);
    console.error(`  ──────────────────────────`);
    console.error(`  Files: ${files.length} | Bundle: ${bundle.name} | Tests: ${opts.numTests}\n`);

    for (const file of files) {
        const relFile = relative(process.cwd(), file);
        console.error(`  Analyzing ${relFile}...`);
        try {
            const reports = await analyzeFile(file, bundle, opts.numTests);
            allReports.push(...reports);
        } catch (err) {
            console.error(`  ✗ Error in ${relFile}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    // Output
    switch (opts.format) {
        case 'json':
            console.log(formatJSON(allReports));
            break;
        case 'github':
            console.log(formatGitHub(allReports));
            break;
        default:
            console.log(formatText(allReports, opts.verbose));
            break;
    }

    // Summary
    const totalTheorems = allReports.length;
    const redundantHypotheses = allReports.flatMap(r => r.hypotheses).filter(h => !h.necessary).length;
    const falseTheorems = allReports.filter(r => r.quickCheck.classification === 'falsified' || r.quickCheck.classification === 'likely_false').length;

    console.error(`\n  Summary: ${totalTheorems} theorems, ${redundantHypotheses} possibly redundant hypotheses, ${falseTheorems} potentially false`);

    // Exit code: 1 if any theorem looks false
    process.exit(falseTheorems > 0 ? 1 : 0);
}

main().catch(err => {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
});
