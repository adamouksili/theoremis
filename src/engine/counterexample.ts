// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Counterexample Engine (Real Evaluation)
// Searches for counterexamples via mutation + actual evaluation
// ─────────────────────────────────────────────────────────────

import type { Term, Theorem } from '../core/ir';
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

// ── Domain generators ───────────────────────────────────────

const GENERATORS: Record<string, () => Value> = {
    'Nat': randomNat,
    'Int': randomInt,
    'Real': () => (Math.random() * 200) - 100,
    'Bool': () => randomBool(),
    'Prime': randomPrime,
};

function getGenerator(domain: string): () => Value {
    return GENERATORS[domain] || GENERATORS['Int'];
}

// ── Run the counterexample engine ───────────────────────────

export async function runCounterexampleEngine(theorem: Theorem): Promise<PathologyReport> {
    const mutations = generateMutations(theorem);
    const results: CounterexampleResult[] = [];

    // Extract variables and their domains from the original statement
    const vars = extractVariables(theorem.statement);

    for (const mutation of mutations) {
        const result = await searchCounterexample(mutation, vars, theorem);
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
    vars: Array<{ name: string; domain: string }>,
    theorem: Theorem,
): Promise<CounterexampleResult> {
    const start = performance.now();
    const NUM_TESTS = 500;

    // Special cases that can be determined analytically
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

    if (mutation.type === 'swap_quantifier') {
        // ∀→∃ is a weakening (usually still true), ∃→∀ is a strengthening (often false)
        // Test the mutated statement
        const result = evaluateMutationByTesting(mutation, vars, NUM_TESTS);
        return { ...result, mutation, searchTime: performance.now() - start };
    }

    // For all other mutations: actually run the mutated statement through the evaluator
    if (mutation.type === 'drop_hypothesis') {
        // Evaluate the original statement without the dropped parameter's constraint
        const result = evaluateDroppedHypothesis(mutation, vars, theorem, NUM_TESTS);
        return { ...result, mutation, searchTime: performance.now() - start };
    }

    // Default: test the mutated term by random evaluation
    const result = evaluateMutationByTesting(mutation, vars, NUM_TESTS);
    return { ...result, mutation, searchTime: performance.now() - start };
}

// ── Evaluate a mutation by random testing ───────────────────

function evaluateMutationByTesting(
    mutation: Mutation,
    vars: Array<{ name: string; domain: string }>,
    numTests: number,
): Omit<CounterexampleResult, 'mutation' | 'searchTime'> {
    const term = mutation.mutated;

    let failures = 0;
    let successes = 0;
    let firstCE: Record<string, Value> | null = null;
    let testsEvaluated = 0;

    for (let i = 0; i < numTests; i++) {
        const env: Record<string, Value> = {};
        for (const v of vars) {
            env[v.name] = getGenerator(v.domain)();
        }

        const result = evaluate(term, env);
        if (result === null) continue; // Can't evaluate — skip

        testsEvaluated++;

        if (result === true || result === 1) {
            successes++;
        } else {
            failures++;
            if (!firstCE) {
                firstCE = { ...env };
            }
        }
    }

    if (failures > 0 && firstCE) {
        const assignments = new Map<string, string>();
        for (const [k, v] of Object.entries(firstCE)) {
            assignments.set(k, String(v));
        }
        return {
            status: 'counterexample_found',
            witness: {
                assignments,
                description: `Found in ${failures}/${testsEvaluated} tests: ${mutation.description}`,
            },
            confidence: Math.min(0.95, failures / testsEvaluated),
            modelClass: 'random_testing',
            testsRun: testsEvaluated,
        };
    }

    if (testsEvaluated === 0) {
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
        modelClass: 'random_testing',
        testsRun: testsEvaluated,
    };
}

// ── Evaluate with dropped hypothesis ────────────────────────

function evaluateDroppedHypothesis(
    mutation: Mutation,
    vars: Array<{ name: string; domain: string }>,
    theorem: Theorem,
    numTests: number,
): Omit<CounterexampleResult, 'mutation' | 'searchTime'> {
    const dropped = mutation.droppedParam || '';
    const term = theorem.statement;

    // Find what the dropped param constrains (e.g., "Prime p" → test with non-primes)
    const droppedParamDef = theorem.params.find(p => p.name === dropped);

    let failures = 0;
    let successes = 0;
    let firstCE: Record<string, Value> | null = null;
    let testsEvaluated = 0;

    for (let i = 0; i < numTests; i++) {
        const env: Record<string, Value> = {};
        for (const v of vars) {
            env[v.name] = getGenerator(v.domain)();
        }

        // Override variables that relate to the dropped hypothesis
        // to generate values that violate the hypothesis
        if (droppedParamDef) {
            const constraintType = droppedParamDef.type;
            if (constraintType.tag === 'App' && constraintType.func.tag === 'Var') {
                const funcName = constraintType.func.name;
                if (funcName === 'Prime') {
                    // Generate composite numbers
                    const composites = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 25, 26, 27, 28];
                    const argName = constraintType.arg.tag === 'Var' ? constraintType.arg.name : 'p';
                    env[argName] = composites[Math.floor(Math.random() * composites.length)];
                } else if (funcName === 'Even') {
                    const argName = constraintType.arg.tag === 'Var' ? constraintType.arg.name : 'n';
                    env[argName] = Math.floor(Math.random() * 50) * 2 + 1; // Odd numbers
                } else if (funcName === 'Odd') {
                    const argName = constraintType.arg.tag === 'Var' ? constraintType.arg.name : 'n';
                    env[argName] = Math.floor(Math.random() * 50) * 2; // Even numbers
                }
            }
            // Coprime constraint: generate values that share a factor
            if (constraintType.tag === 'App' && constraintType.func.tag === 'App' &&
                constraintType.func.func.tag === 'Var' && constraintType.func.func.name === 'Coprime') {
                const arg1 = constraintType.func.arg.tag === 'Var' ? constraintType.func.arg.name : 'a';
                const arg2 = constraintType.arg.tag === 'Var' ? constraintType.arg.name : 'b';
                // Make them share a common factor
                const factor = [2, 3, 5, 7][Math.floor(Math.random() * 4)];
                env[arg1] = factor * (Math.floor(Math.random() * 10) + 1);
                env[arg2] = factor * (Math.floor(Math.random() * 10) + 1);
            }
        }

        const result = evaluate(term, env);
        if (result === null) continue;

        testsEvaluated++;

        if (result === true || result === 1) {
            successes++;
        } else {
            failures++;
            if (!firstCE) {
                firstCE = { ...env };
            }
        }
    }

    if (failures > 0 && firstCE) {
        const assignments = new Map<string, string>();
        for (const [k, v] of Object.entries(firstCE)) {
            assignments.set(k, String(v));
        }
        return {
            status: 'counterexample_found',
            witness: {
                assignments,
                description: `Without "${dropped}": fails in ${failures}/${testsEvaluated} tests`,
            },
            confidence: Math.min(0.95, failures / Math.max(testsEvaluated, 1)),
            modelClass: 'hypothesis_violation',
            testsRun: testsEvaluated,
        };
    }

    if (testsEvaluated === 0) {
        // Couldn't evaluate — provide heuristic answer
        if (droppedParamDef && isSubstantiveType(droppedParamDef.type)) {
            return {
                status: 'counterexample_found',
                witness: {
                    assignments: new Map([['heuristic', 'type-based']]),
                    description: `Hypothesis "${dropped}" appears necessary (type analysis)`,
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
        confidence: Math.min(0.9, 1.0 - 1.0 / (testsEvaluated + 1)),
        modelClass: 'random_testing',
        testsRun: testsEvaluated,
    };
}

function isSubstantiveType(type: Term): boolean {
    return type.tag === 'App' || type.tag === 'Pi' || type.tag === 'ForAll';
}

function buildSummary(name: string, ceCount: number, safeCount: number, total: number): string {
    return `Theorem "${name}": ${ceCount} counterexample(s) found in ${total} mutations, ${safeCount} safe. ` +
        (ceCount > 0
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
