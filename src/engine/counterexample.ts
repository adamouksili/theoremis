// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Counterexample Engine (Real Evaluation)
// Searches for counterexamples via mutation + actual evaluation
// ─────────────────────────────────────────────────────────────

import type { Term, Theorem, Param } from '../core/ir';
import { generateMutations, type Mutation } from './mutator';
import { evaluate, extractVariables, randomNat, randomInt, randomPrime, randomBool, type Value } from './evaluator';

export type CEStatus = 'counterexample_found' | 'no_counterexample' | 'timeout' | 'searching';

export interface CounterexampleResult {
    mutation: Mutation;
    status: CEStatus;
    witness?: Witness;
    confidence: number;
    searchTime: number;
    modelClass: string;
    testsRun: number;
}

export interface Witness {
    assignments: Map<string, string>;
    description: string;
}

export interface PathologyReport {
    theoremName: string;
    results: CounterexampleResult[];
    overallConfidence: number;
    timestamp: number;
    summary: string;
}

interface VarSpec {
    name: string;
    generator: () => Value;
}

// ── Domain generators ───────────────────────────────────────

const GENERATORS: Record<string, () => Value> = {
    'Nat': randomNat,
    'Int': randomInt,
    'Real': (): Value => (Math.random() * 200) - 100,
    'Bool': (): Value => randomBool(),
    'Prime': randomPrime,
};

const COMPOSITES = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 25, 26, 27, 28];
const FACTORS = [2, 3, 5, 7];

function getGenerator(domain: string): () => Value {
    return GENERATORS[domain] || GENERATORS['Int'];
}

// ── Run the counterexample engine ───────────────────────────

export async function runCounterexampleEngine(theorem: Theorem): Promise<PathologyReport> {
    const mutations = generateMutations(theorem);
    const results: CounterexampleResult[] = [];

    const varSpecs: VarSpec[] = extractVariables(theorem.statement)
        .map(v => ({ name: v.name, generator: getGenerator(v.domain) }));

    for (let i = 0; i < mutations.length; i++) {
        const result = await searchCounterexample(mutations[i], varSpecs, theorem);
        results.push(result);
    }

    const ceCount = results.filter(r => r.status === 'counterexample_found').length;
    const safeCount = results.filter(r => r.status === 'no_counterexample').length;
    const overallConfidence = safeCount / Math.max(results.length, 1);

    return {
        theoremName: theorem.name,
        results,
        overallConfidence,
        timestamp: Date.now(),
        summary: buildSummary(theorem.name, ceCount, safeCount, results.length),
    };
}

// ── Search for counterexamples via real evaluation ──────────

async function searchCounterexample(
    mutation: Mutation,
    vars: VarSpec[],
    theorem: Theorem,
): Promise<CounterexampleResult> {
    const start = performance.now();
    const NUM_TESTS = 500;

    if (mutation.type === 'negate_conclusion') {
        return {
            mutation,
            status: 'counterexample_found',
            witness: {
                assignments: new Map([['trivial', 'original holds']]),
                description: 'Negation contradicts original theorem',
            },
            confidence: 1.0,
            searchTime: performance.now() - start,
            modelClass: 'logical',
            testsRun: 0,
        };
    }

    if (mutation.type === 'drop_hypothesis') {
        const droppedParam = theorem.params.find(p => p.name === (mutation.droppedParam || ''));
        const override = makeDropHypothesisOverride(droppedParam);
        const result = evaluateByRandomTesting(
            theorem.statement,
            vars,
            NUM_TESTS,
            `Without "${mutation.droppedParam}": theorem remains true in tested cases`,
            'hypothesis_violation',
            override,
            droppedParam,
            mutation.droppedParam,
        );
        return { ...result, mutation, searchTime: performance.now() - start };
    }

    const result = evaluateByRandomTesting(
        mutation.mutated,
        vars,
        NUM_TESTS,
        mutation.description,
        'random_testing',
    );
    return { ...result, mutation, searchTime: performance.now() - start };
}

// ── Evaluate a mutation by random testing ───────────────────

function evaluateByRandomTesting(
    term: Term,
    vars: VarSpec[],
    numTests: number,
    description: string,
    modelClass: string,
    mutateEnv?: ((env: Record<string, Value>) => void) | null,
    droppedParamDef?: Param,
    droppedParamName?: string,
): Omit<CounterexampleResult, 'mutation' | 'searchTime'> {
    let failures = 0;
    let testsEvaluated = 0;
    let firstCE: Record<string, Value> | null = null;
    const env: Record<string, Value> = {};
    const varNames = vars.map(v => v.name);
    const generators = vars.map(v => v.generator);

    for (let i = 0; i < numTests; i++) {
        for (let j = 0; j < varNames.length; j++) {
            env[varNames[j]] = generators[j]();
        }
        if (mutateEnv) mutateEnv(env);

        const result = evaluate(term, env);
        if (result === null) continue;

        testsEvaluated++;
        if (result === true || result === 1) continue;

        failures++;
        if (!firstCE) firstCE = { ...env };
    }

    if (failures > 0 && firstCE) {
        return {
            status: 'counterexample_found',
            witness: toWitness(firstCE, `Found in ${failures}/${testsEvaluated} tests: ${description}`),
            confidence: Math.min(0.95, failures / Math.max(testsEvaluated, 1)),
            modelClass,
            testsRun: testsEvaluated,
        };
    }

    if (testsEvaluated === 0) {
        if (droppedParamDef && droppedParamName && isSubstantiveType(droppedParamDef.type)) {
            return {
                status: 'counterexample_found',
                witness: {
                    assignments: new Map([['heuristic', 'type-based']]),
                    description: `Hypothesis "${droppedParamName}" appears necessary (type analysis)`,
                },
                confidence: 0.7,
                modelClass: 'heuristic',
                testsRun: 0,
            };
        }

        return {
            status: 'timeout',
            confidence: 0.3,
            modelClass: 'unevaluable',
            testsRun: 0,
        };
    }

    return {
        status: 'no_counterexample',
        confidence: Math.min(0.95, 1.0 - 1.0 / (testsEvaluated + 1)),
        modelClass,
        testsRun: testsEvaluated,
    };
}

function toWitness(assignments: Record<string, Value>, description: string): Witness {
    const mapped = new Map<string, string>();
    for (const [k, v] of Object.entries(assignments)) mapped.set(k, String(v));
    return { assignments: mapped, description };
}

// ── Drop-hypothesis overrides ───────────────────────────────

function makeDropHypothesisOverride(param?: Param): ((env: Record<string, Value>) => void) | null {
    if (!param) return null;

    const t = param.type;

    // Prime(p), Even(n), Odd(n)
    if (t.tag === 'App' && t.func.tag === 'Var') {
        const argName = t.arg.tag === 'Var' ? t.arg.name : inferVarName(t.func.name);
        if (t.func.name === 'Prime') {
            return (env) => {
                env[argName] = COMPOSITES[Math.floor(Math.random() * COMPOSITES.length)];
            };
        }
        if (t.func.name === 'Even') {
            return (env) => {
                env[argName] = Math.floor(Math.random() * 50) * 2 + 1;
            };
        }
        if (t.func.name === 'Odd') {
            return (env) => {
                env[argName] = Math.floor(Math.random() * 50) * 2;
            };
        }
    }

    // Coprime(a)(b)
    if (
        t.tag === 'App'
        && t.func.tag === 'App'
        && t.func.func.tag === 'Var'
        && t.func.func.name === 'Coprime'
    ) {
        const arg1 = t.func.arg.tag === 'Var' ? t.func.arg.name : 'a';
        const arg2 = t.arg.tag === 'Var' ? t.arg.name : 'b';
        return (env) => {
            const factor = FACTORS[Math.floor(Math.random() * FACTORS.length)];
            env[arg1] = factor * (Math.floor(Math.random() * 10) + 1);
            env[arg2] = factor * (Math.floor(Math.random() * 10) + 1);
        };
    }

    return null;
}

function inferVarName(predicate: string): string {
    if (predicate === 'Prime') return 'p';
    if (predicate === 'Even' || predicate === 'Odd') return 'n';
    return 'x';
}

function isSubstantiveType(type: Term): boolean {
    return type.tag === 'App' || type.tag === 'Pi' || type.tag === 'ForAll';
}

function buildSummary(name: string, ceCount: number, safeCount: number, total: number): string {
    return `Theorem "${name}": ${ceCount} counterexample(s) found in ${total} mutations, ${safeCount} safe. `
        + (ceCount > 0
            ? `The theorem's hypotheses appear necessary — mutations that remove them produce counterexamples.`
            : `No counterexamples found; theorem appears robust under all tested mutations.`);
}

// ── Format report for display ───────────────────────────────

export function formatReport(report: PathologyReport): string {
    const lines: string[] = [
        `══════ Pathology Report: ${report.theoremName} ══════`,
        `Overall Confidence: ${(report.overallConfidence * 100).toFixed(1)}%`,
        `Mutations Tested: ${report.results.length}`,
        ``,
        report.summary,
        ``,
    ];

    for (const r of report.results) {
        const icon = r.status === 'counterexample_found' ? '✗' : r.status === 'no_counterexample' ? '✓' : '?';
        const statusColor = r.status === 'counterexample_found' ? 'CE FOUND' : r.status === 'no_counterexample' ? 'SAFE' : 'TIMEOUT';
        lines.push(`  ${icon} [${statusColor}] ${r.mutation.description}`);
        if (r.witness) {
            lines.push(`     └─ ${r.witness.description}`);
            for (const [k, v] of r.witness.assignments) {
                lines.push(`        ${k} = ${v}`);
            }
        }
        lines.push(`     (${r.modelClass}, ${r.searchTime.toFixed(0)}ms, ${r.testsRun} tests, conf: ${(r.confidence * 100).toFixed(0)}%)`);
        lines.push('');
    }

    return lines.join('\n');
}
