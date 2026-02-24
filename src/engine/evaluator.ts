// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Partial IR Evaluator
// QuickCheck-style random testing of IR terms
// ─────────────────────────────────────────────────────────────

import type { Term } from '../core/ir';

export type Value = number | boolean | string | null;

export interface TestResult {
    passed: boolean;
    witness: Record<string, Value>;
    evaluated: Value;
}

export interface RandomTestReport {
    totalTests: number;
    passed: number;
    failed: number;
    counterexamples: TestResult[];
    time: number;
}

// ── Evaluate an IR term with given variable bindings ────────

export function evaluate(term: Term, env: Record<string, Value>): Value {
    switch (term.tag) {
        case 'Literal': {
            // Parse numeric literals to numbers so arithmetic works consistently
            if (term.kind === 'Nat' || term.kind === 'Int') {
                const n = Number(term.value);
                return Number.isFinite(n) ? n : null;
            }
            if (term.kind === 'Bool') return term.value === 'true';
            return term.value;
        }

        case 'Var':
            return env[term.name] ?? null;

        case 'BinOp': {
            const l = evaluate(term.left, env);
            const r = evaluate(term.right, env);
            if (l === null || r === null) return null;
            return evalBinOp(term.op, l, r);
        }

        case 'UnaryOp': {
            const v = evaluate(term.operand, env);
            if (v === null) return null;
            if (term.op === '¬' && typeof v === 'boolean') return !v;
            if (term.op === '-' && typeof v === 'number') return -v;
            return null;
        }

        case 'ForAll': {
            // Can't fully evaluate ∀ — handled by random testing
            return null;
        }

        case 'Exists': {
            return null;
        }

        case 'App': {
            const fn = term.func;
            const arg = evaluate(term.arg, env);
            if (fn.tag === 'Var') {
                // Built-in functions
                if (fn.name === 'Prime' && typeof arg === 'number') return isPrime(arg);
                if (fn.name === 'Even' && typeof arg === 'number') return arg % 2 === 0;
                if (fn.name === 'Odd' && typeof arg === 'number') return arg % 2 !== 0;
                if (fn.name === 'abs' && typeof arg === 'number') return Math.abs(arg);
                if (fn.name === 'sqrt' && typeof arg === 'number') return Math.sqrt(arg);
            }
            // Coprime(a)(p) — two-arg curried
            if (fn.tag === 'App' && fn.func.tag === 'Var' && fn.func.name === 'Coprime') {
                const a = evaluate(fn.arg, env);
                if (typeof a === 'number' && typeof arg === 'number') {
                    return gcd(Math.abs(a), Math.abs(arg)) === 1;
                }
            }
            return null;
        }

        case 'Equiv': {
            const l = evaluate(term.left, env);
            const r = evaluate(term.right, env);
            const m = term.modulus ? evaluate(term.modulus, env) : null;
            if (typeof l === 'number' && typeof r === 'number' && typeof m === 'number' && m !== 0) {
                return ((l % m) + m) % m === ((r % m) + m) % m;
            }
            return null;
        }

        case 'Lam':
            return null; // Can't evaluate lambda as a value

        case 'Pi':
        case 'Sigma':
        case 'Sort':
        case 'Ind':
        case 'Match':
            return null;

        case 'Hole':
            return null;

        case 'AxiomRef':
            return true; // Axioms are assumed true

        case 'LetIn': {
            const val = evaluate(term.value, env);
            return evaluate(term.body, { ...env, [term.name]: val });
        }

        case 'Pair': {
            const fstV = evaluate(term.fst, env);
            const sndV = evaluate(term.snd, env);
            // Return snd (typically the proposition) if both components evaluate
            return fstV !== null && sndV !== null ? sndV : null;
        }

        case 'Proj': {
            return null;
        }
    }
}

function evalBinOp(op: string, l: Value, r: Value): Value {
    if (typeof l === 'number' && typeof r === 'number') {
        switch (op) {
            case '+': return l + r;
            case '-': return l - r;
            case '*': return l * r;
            case '/': return r !== 0 ? l / r : null;
            case '^': return Math.pow(l, r);
            case 'mod': return r !== 0 ? ((l % r) + r) % r : null;
            case '=': return l === r;
            case '≤': return l <= r;
            case '≥': return l >= r;
            case '<': return l < r;
            case '>': return l > r;
        }
    }
    if (typeof l === 'boolean' && typeof r === 'boolean') {
        switch (op) {
            case '∧': return l && r;
            case '∨': return l || r;
            case '→': return !l || r;
            case '↔': return l === r;
        }
    }
    if (op === '=') return l === r;
    if (op === '∈') return true; // Domain membership assumed true for generated values
    return null;
}

// ── Random value generators ─────────────────────────────────

export function randomNat(): number {
    return Math.floor(Math.random() * 100);
}

export function randomInt(): number {
    return Math.floor(Math.random() * 201) - 100;
}

export function randomReal(): number {
    return (Math.random() * 200) - 100;
}

export function randomPrime(): number {
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
    return primes[Math.floor(Math.random() * primes.length)];
}

export function randomBool(): boolean {
    return Math.random() < 0.5;
}

interface DomainSpec {
    name: string;
    generator: () => Value;
}

const DOMAINS: Record<string, DomainSpec> = {
    'Nat': { name: 'ℕ', generator: randomNat },
    'Int': { name: 'ℤ', generator: randomInt },
    'Real': { name: 'ℝ', generator: randomReal },
    'Bool': { name: 'Bool', generator: () => randomBool() },
    'Prime': { name: 'Prime', generator: randomPrime },
};

// ── QuickCheck-style testing ────────────────────────────────

export function quickCheck(
    term: Term,
    variables: Array<{ name: string; domain: string }>,
    numTests: number = 1000,
): RandomTestReport {
    const start = performance.now();
    const counterexamples: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < numTests; i++) {
        const env: Record<string, Value> = {};
        for (const v of variables) {
            const dom = DOMAINS[v.domain] ?? DOMAINS['Int'];
            env[v.name] = dom.generator();
        }

        const result = evaluate(term, env);
        if (result === null) {
            // Can't evaluate — skip
            continue;
        }
        if (result === true || result === 1) {
            passed++;
        } else {
            failed++;
            if (counterexamples.length < 5) {
                counterexamples.push({ passed: false, witness: { ...env }, evaluated: result });
            }
        }
    }

    return {
        totalTests: passed + failed,
        passed,
        failed,
        counterexamples,
        time: performance.now() - start,
    };
}

// ── Extract free variables and their likely domains from IR ──

export function extractVariables(term: Term): Array<{ name: string; domain: string }> {
    const vars = new Map<string, string>();
    collectVars(term, vars);
    return Array.from(vars.entries()).map(([name, domain]) => ({ name, domain }));
}

function collectVars(term: Term, vars: Map<string, string>) {
    switch (term.tag) {
        case 'Var':
            if (!vars.has(term.name) && !isBuiltIn(term.name)) {
                vars.set(term.name, 'Int');
            }
            break;
        case 'ForAll':
        case 'Exists':
            // The bound variable's domain is the domain field
            vars.set(term.param, domainFromType(term.domain));
            collectVars(term.body, vars);
            break;
        case 'BinOp':
            collectVars(term.left, vars);
            collectVars(term.right, vars);
            break;
        case 'UnaryOp':
            collectVars(term.operand, vars);
            break;
        case 'App':
            collectVars(term.func, vars);
            collectVars(term.arg, vars);
            break;
        case 'Lam':
        case 'Pi':
        case 'Sigma':
            collectVars(term.paramType, vars);
            collectVars(term.body, vars);
            break;
        case 'Equiv':
            collectVars(term.left, vars);
            collectVars(term.right, vars);
            if (term.modulus) collectVars(term.modulus, vars);
            break;
        case 'LetIn':
            collectVars(term.value, vars);
            collectVars(term.body, vars);
            break;
        case 'Pair':
            collectVars(term.fst, vars);
            collectVars(term.snd, vars);
            break;
        case 'Match':
            collectVars(term.scrutinee, vars);
            for (const c of term.cases) {
                collectVars(c.body, vars);
            }
            break;
        case 'Proj':
            collectVars(term.term, vars);
            break;
        case 'Ind':
            collectVars(term.type, vars);
            for (const ctor of term.constructors) {
                collectVars(ctor.type, vars);
            }
            break;
    }
}

function domainFromType(type: Term): string {
    if (type.tag === 'Sort') {
        if (type.universe.tag === 'Type') return 'Nat';
        return 'Int';
    }
    if (type.tag === 'Var') {
        const n = type.name;
        if (n === 'Nat' || n === 'ℕ') return 'Nat';
        if (n === 'Int' || n === 'ℤ') return 'Int';
        if (n === 'Real' || n === 'ℝ' || n === 'R') return 'Real';
        if (n === 'Complex' || n === 'ℂ' || n === 'C') return 'Real';
        if (n === 'Bool') return 'Bool';
        if (n === 'Prime') return 'Prime';
    }
    // Handle App like Prime(n) or Set(ℕ)
    if (type.tag === 'App' && type.func.tag === 'Var') {
        if (type.func.name === 'Prime') return 'Prime';
    }
    return 'Int';
}

function isBuiltIn(name: string): boolean {
    return ['Nat', 'Int', 'Real', 'Complex', 'Bool', 'Prop', 'Type', 'Prime', 'Even', 'Odd',
        'Coprime', 'True', 'False', 'abs', 'sqrt', 'gcd', 'lcm',
        'ℕ', 'ℤ', 'ℝ', 'ℂ',
        'Divisors', 'ZMod', 'Set', 'List', 'Group', 'Ring', 'Field',
        'TopologicalSpace', 'Graph'].includes(name);
}

// ── Math utilities ──────────────────────────────────────────

function isPrime(n: number): boolean {
    if (n < 2) return false;
    if (n < 4) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (let i = 5; i * i <= n; i += 6) {
        if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
}

function gcd(a: number, b: number): number {
    while (b !== 0) { [a, b] = [b, a % b]; }
    return a;
}
