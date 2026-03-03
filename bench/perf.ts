#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { apiParse, apiEmit, apiAnalyze, buildPipelineContext } from '../src/api/pipeline';
import { runCounterexampleEngine } from '../src/engine/counterexample';
import type { Theorem } from '../src/core/ir';

interface PerfBudgets {
    parseMs: number;
    emitMs: number;
    analyze500Ms: number;
    analyze5000Ms: number;
    counterexamplePerTheoremMs: number;
}

interface PerfBaselines {
    parseMs: number;
    emitMs: number;
    analyze500Ms: number;
    analyze5000Ms: number;
    counterexamplePerTheoremMs: number;
}

interface BenchmarkSpec {
    warmup: number;
    runs: number;
}

interface MetricStats {
    medianMs: number;
    p90Ms: number;
    runs: number;
    warmupRuns: number;
}

interface PerfReport {
    version: number;
    ciMode: boolean;
    tolerancePct: number;
    theoremCount: number;
    timestamp: string;
    metrics: {
        parseMs: MetricStats;
        emitMs: MetricStats;
        analyze500Ms: MetricStats;
        analyze5000Ms: MetricStats;
        counterexamplePerTheoremMs: MetricStats;
    };
}

const PERF_SEED = 1337;
const CI_TOLERANCE = 0.08;
const DRIFT_TOLERANCE = 0.15;

const SPECS: Record<string, BenchmarkSpec> = {
    parse: { warmup: 5, runs: 20 },
    emit: { warmup: 5, runs: 20 },
    analyze500: { warmup: 8, runs: 20 },
    analyze5000: { warmup: 10, runs: 12 },
    counterexample: { warmup: 4, runs: 10 },
};

function quantile(values: number[], q: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const pos = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1));
    return sorted[pos];
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

async function benchmark(
    name: string,
    fn: () => void | Promise<void>,
    spec: BenchmarkSpec,
): Promise<MetricStats> {
    for (let i = 0; i < spec.warmup; i++) await fn();

    const samples: number[] = [];
    for (let i = 0; i < spec.runs; i++) {
        const start = performance.now();
        await fn();
        samples.push(performance.now() - start);
    }

    const medianMs = median(samples);
    const p90Ms = quantile(samples, 0.9);
    console.log(
        `  ${name.padEnd(28)} median=${medianMs.toFixed(2)} ms  p90=${p90Ms.toFixed(2)} ms (n=${spec.runs}, warmup=${spec.warmup})`,
    );

    return {
        medianMs: Number(medianMs.toFixed(2)),
        p90Ms: Number(p90Ms.toFixed(2)),
        runs: spec.runs,
        warmupRuns: spec.warmup,
    };
}

function readBudgets(): PerfBudgets {
    const budgetPath = resolve(import.meta.dirname ?? '.', 'perf-budget.json');
    const parsed = JSON.parse(readFileSync(budgetPath, 'utf8')) as { performance: PerfBudgets };
    return parsed.performance;
}

function readBaseline(): PerfBaselines | null {
    try {
        const baselinePath = resolve(import.meta.dirname ?? '.', 'perf-baseline.json');
        const parsed = JSON.parse(readFileSync(baselinePath, 'utf8')) as { baseline: PerfBaselines };
        return parsed.baseline;
    } catch {
        return null;
    }
}

function writeArtifact(report: PerfReport): void {
    const outDir = resolve(import.meta.dirname ?? '.', 'artifacts');
    mkdirSync(outDir, { recursive: true });
    const outFile = resolve(outDir, 'perf-report.json');
    writeFileSync(outFile, JSON.stringify(report, null, 2));
}

async function main() {
    const ciMode = process.argv.includes('--ci');
    const tolerance = ciMode ? CI_TOLERANCE : 0;

    const fixturePath = resolve(import.meta.dirname ?? '.', 'fixtures/internal/core-theorems.tex');
    const latex = readFileSync(fixturePath, 'utf8');

    const ctx = buildPipelineContext(latex, 'ClassicalMath');
    const theorems = ctx.ir.declarations.filter(
        (d): d is Theorem => d.tag === 'Theorem' || d.tag === 'Lemma',
    );

    console.log('\n  Theoremis Performance Harness');
    console.log('  ═════════════════════════════\n');

    const parseMs = await benchmark('apiParse', () => {
        apiParse(latex, 'ClassicalMath');
    }, SPECS.parse);

    const emitMs = await benchmark('apiEmit', () => {
        apiEmit(latex, 'ClassicalMath');
    }, SPECS.emit);

    const analyze500Ms = await benchmark('apiAnalyze(numTests=500)', () => {
        apiAnalyze(latex, 'ClassicalMath', 500, { seed: PERF_SEED });
    }, SPECS.analyze500);

    const analyze5000Ms = await benchmark('apiAnalyze(numTests=5000)', () => {
        apiAnalyze(latex, 'ClassicalMath', 5000, { seed: PERF_SEED });
    }, SPECS.analyze5000);

    const counterexampleBatchMs = await benchmark('counterexample batch', async () => {
        for (let i = 0; i < theorems.length; i++) {
            await runCounterexampleEngine(theorems[i]);
        }
    }, SPECS.counterexample);

    const counterexamplePerTheoremMs: MetricStats = {
        medianMs: Number((theorems.length > 0 ? counterexampleBatchMs.medianMs / theorems.length : 0).toFixed(2)),
        p90Ms: Number((theorems.length > 0 ? counterexampleBatchMs.p90Ms / theorems.length : 0).toFixed(2)),
        runs: counterexampleBatchMs.runs,
        warmupRuns: counterexampleBatchMs.warmupRuns,
    };

    const report: PerfReport = {
        version: 2,
        ciMode,
        tolerancePct: ciMode ? CI_TOLERANCE * 100 : 0,
        theoremCount: theorems.length,
        timestamp: new Date().toISOString(),
        metrics: {
            parseMs,
            emitMs,
            analyze500Ms,
            analyze5000Ms,
            counterexamplePerTheoremMs,
        },
    };

    console.log(
        `  counterexample/theorem         median=${counterexamplePerTheoremMs.medianMs.toFixed(2)} ms  p90=${counterexamplePerTheoremMs.p90Ms.toFixed(2)} ms`,
    );

    writeArtifact(report);
    console.log('\n  JSON:');
    console.log(`  ${JSON.stringify(report)}`);

    if (!ciMode) return;

    const budgets = readBudgets();
    const failures: string[] = [];

    const over = (observed: number, budget: number, label: string, useTolerance: boolean) => {
        const allowed = budget * (useTolerance ? 1 + tolerance : 1);
        if (observed > allowed) {
            failures.push(`${label} ${observed} > ${allowed.toFixed(2)} (budget ${budget}${useTolerance ? ` + ${Math.round(tolerance * 100)}%` : ''})`);
        }
    };

    // Critical metrics keep hard caps.
    over(report.metrics.analyze5000Ms.medianMs, budgets.analyze5000Ms, 'analyze5000Ms', false);
    over(report.metrics.counterexamplePerTheoremMs.medianMs, budgets.counterexamplePerTheoremMs, 'counterexamplePerTheoremMs', false);

    // Non-critical metrics get CI jitter tolerance.
    over(report.metrics.parseMs.medianMs, budgets.parseMs, 'parseMs', true);
    over(report.metrics.emitMs.medianMs, budgets.emitMs, 'emitMs', true);
    over(report.metrics.analyze500Ms.medianMs, budgets.analyze500Ms, 'analyze500Ms', true);

    const baseline = readBaseline();
    if (baseline) {
        const driftChecks: Array<[number, number, string]> = [
            [report.metrics.parseMs.medianMs, baseline.parseMs, 'parseMs'],
            [report.metrics.emitMs.medianMs, baseline.emitMs, 'emitMs'],
            [report.metrics.analyze500Ms.medianMs, baseline.analyze500Ms, 'analyze500Ms'],
            [report.metrics.analyze5000Ms.medianMs, baseline.analyze5000Ms, 'analyze5000Ms'],
            [report.metrics.counterexamplePerTheoremMs.medianMs, baseline.counterexamplePerTheoremMs, 'counterexamplePerTheoremMs'],
        ];

        for (const [observed, base, label] of driftChecks) {
            const maxAllowed = base * (1 + DRIFT_TOLERANCE);
            if (observed > maxAllowed) {
                failures.push(`${label} regressed vs baseline (${observed} > ${maxAllowed.toFixed(2)})`);
            }
        }
    }

    if (failures.length > 0) {
        console.error('\n  PERF BUDGET FAILURES:');
        for (const failure of failures) console.error(`  - ${failure}`);
        process.exit(1);
    }

    console.log('\n  Performance budgets: PASS');
}

main().catch((err) => {
    console.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
});
