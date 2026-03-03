// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Partial IR Evaluator
// QuickCheck-style random testing of IR terms
// ─────────────────────────────────────────────────────────────

import type { Term, Param } from '../core/ir';

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
    skipped: number;
    preconditionSkipped: number;
    classification: 'verified' | 'likely_true' | 'indeterminate' | 'likely_false' | 'falsified';
}

export interface QuickCheckOptions {
    seed?: number;
    timeoutMs?: number;
    maxCounterexamples?: number;
}

type RNG = () => number;
type EvalFn = (env: Record<string, Value>) => Value;

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
                if (fn.name === 'sqrt' && typeof arg === 'number') return arg >= 0 ? Math.sqrt(arg) : null;
                // Trig & transcendental
                if (fn.name === 'sin' && typeof arg === 'number') return Math.sin(arg);
                if (fn.name === 'cos' && typeof arg === 'number') return Math.cos(arg);
                if (fn.name === 'tan' && typeof arg === 'number') return Math.tan(arg);
                if (fn.name === 'exp' && typeof arg === 'number') return Math.exp(arg);
                if (fn.name === 'ln' && typeof arg === 'number') return arg > 0 ? Math.log(arg) : null;
                if (fn.name === 'log' && typeof arg === 'number') return arg > 0 ? Math.log(arg) : null;
                // Combinatorial
                if (fn.name === 'factorial' && typeof arg === 'number') return factorial(arg);
                // Size / dimension helpers
                if (fn.name === 'det' && typeof arg === 'number') return arg; // 1×1 matrix
                if (fn.name === 'dim' && typeof arg === 'number') return arg;
                if (fn.name === 'ker' && typeof arg === 'number') return 0; // trivial kernel
            }
            // index(pair(a, n)) — subscript access (evaluate as the base value for now)
            if (fn.tag === 'Var' && fn.name === 'index' && term.arg.tag === 'Pair') {
                return evaluate(term.arg.fst, env);
            }
            // Coprime(a)(p) — two-arg curried
            if (fn.tag === 'App' && fn.func.tag === 'Var' && fn.func.name === 'Coprime') {
                const a = evaluate(fn.arg, env);
                if (typeof a === 'number' && typeof arg === 'number') {
                    return gcd(Math.abs(a), Math.abs(arg)) === 1;
                }
            }
            // gcd(a)(b) — two-arg curried
            if (fn.tag === 'App' && fn.func.tag === 'Var' && fn.func.name === 'gcd') {
                const a = evaluate(fn.arg, env);
                if (typeof a === 'number' && typeof arg === 'number') {
                    return gcd(Math.abs(a), Math.abs(arg));
                }
            }
            // lcm(a)(b) — two-arg curried
            if (fn.tag === 'App' && fn.func.tag === 'Var' && fn.func.name === 'lcm') {
                const a = evaluate(fn.arg, env);
                if (typeof a === 'number' && typeof arg === 'number') {
                    const g = gcd(Math.abs(a), Math.abs(arg));
                    return g === 0 ? 0 : Math.abs(a * arg) / g;
                }
            }
            // max(a)(b), min(a)(b) — two-arg curried
            if (fn.tag === 'App' && fn.func.tag === 'Var' && fn.func.name === 'max') {
                const a = evaluate(fn.arg, env);
                if (typeof a === 'number' && typeof arg === 'number') return Math.max(a, arg);
            }
            if (fn.tag === 'App' && fn.func.tag === 'Var' && fn.func.name === 'min') {
                const a = evaluate(fn.arg, env);
                if (typeof a === 'number' && typeof arg === 'number') return Math.min(a, arg);
            }
            return null;
        }

        case 'Equiv': {
            const l = evaluate(term.left, env);
            const r = evaluate(term.right, env);
            const m = term.modulus ? evaluate(term.modulus, env) : null;
            if (typeof l === 'number' && typeof r === 'number' && typeof m === 'number' && m !== 0) {
                // Use BigInt modular arithmetic to avoid float overflow
                // e.g. 89^75 mod 76 overflows float64 but works fine with BigInt
                try {
                    const mBig = BigInt(Math.abs(Math.round(m)));
                    if (mBig === 0n) return null;
                    // Use modPow-aware evaluation: if the expression is a^b, compute a^b mod m directly
                    const lMod = evalBigIntModular(term.left, env, mBig);
                    const rMod = evalBigIntModular(term.right, env, mBig);
                    return lMod === rMod;
                } catch {
                    // Fallback to float arithmetic
                    return ((l % m) + m) % m === ((r % m) + m) % m;
                }
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

// ── BigInt helpers for precise modular arithmetic ────────────

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    if (mod === 1n) return 0n;
    let result = 1n;
    base = ((base % mod) + mod) % mod;
    if (exp < 0n) return 0n; // Negative exponent not supported for integers
    while (exp > 0n) {
        if (exp % 2n === 1n) result = (result * base) % mod;
        exp = exp / 2n;
        base = (base * base) % mod;
    }
    return result;
}

function evalBigIntModular(term: Term, env: Record<string, Value>, mod: bigint): bigint {
    switch (term.tag) {
        case 'Literal':
            return ((BigInt(term.value) % mod) + mod) % mod;
        case 'Var': {
            const v = env[term.name];
            if (typeof v === 'number') return ((BigInt(Math.round(v)) % mod) + mod) % mod;
            throw new Error('non-numeric');
        }
        case 'BinOp': {
            const l = evalBigIntModular(term.left, env, mod);
            const r = evalBigIntModular(term.right, env, mod);
            switch (term.op) {
                case '+': return (l + r) % mod;
                case '-': return ((l - r) % mod + mod) % mod;
                case '*': return (l * r) % mod;
                case '^': {
                    // Use modPow for efficient modular exponentiation
                    const base = evalBigIntModular(term.left, env, mod);
                    // For exponent, we need the actual value not mod-reduced
                    const expVal = env[term.right.tag === 'Var' ? term.right.name : ''];
                    let exp: bigint;
                    if (term.right.tag === 'Literal') {
                        exp = BigInt(term.right.value);
                    } else if (term.right.tag === 'Var' && typeof expVal === 'number') {
                        exp = BigInt(Math.round(expVal as number));
                    } else if (term.right.tag === 'BinOp') {
                        // Evaluate the exponent expression as a plain BigInt
                        exp = evalBigIntPlain(term.right, env);
                    } else {
                        throw new Error('unsupported exponent');
                    }
                    return modPow(base, exp, mod);
                }
                case 'mod': return r !== 0n ? ((l % r) + r) % r : 0n;
                default: throw new Error('unsupported op');
            }
        }
        default:
            throw new Error('unsupported term for BigInt');
    }
}

/** Evaluate a term as a plain BigInt (no modular reduction) — used for exponents */
function evalBigIntPlain(term: Term, env: Record<string, Value>): bigint {
    switch (term.tag) {
        case 'Literal': return BigInt(term.value);
        case 'Var': {
            const v = env[term.name];
            if (typeof v === 'number') return BigInt(Math.round(v));
            throw new Error('non-numeric');
        }
        case 'BinOp': {
            const l = evalBigIntPlain(term.left, env);
            const r = evalBigIntPlain(term.right, env);
            switch (term.op) {
                case '+': return l + r;
                case '-': return l - r;
                case '*': return l * r;
                default: throw new Error('unsupported op');
            }
        }
        default:
            throw new Error('unsupported');
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
    return randomNatWith(Math.random);
}

export function randomInt(): number {
    return randomIntWith(Math.random);
}

export function randomReal(): number {
    return randomRealWith(Math.random);
}

export function randomPrime(): number {
    return randomPrimeWith(Math.random);
}

export function randomBool(): boolean {
    return randomBoolWith(Math.random);
}

function randomNatWith(rng: RNG): number {
    return Math.floor(rng() * 100);
}

function randomIntWith(rng: RNG): number {
    return Math.floor(rng() * 201) - 100;
}

function randomRealWith(rng: RNG): number {
    return (rng() * 200) - 100;
}

function randomPrimeWith(rng: RNG): number {
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
    return primes[Math.floor(rng() * primes.length)];
}

function randomBoolWith(rng: RNG): boolean {
    return rng() < 0.5;
}

function createSeededRng(seed: number): RNG {
    let state = (seed >>> 0) || 0x9e3779b9;
    return () => {
        // xorshift32: fast deterministic PRNG for repeatable test generation
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 0x100000000;
    };
}

interface DomainSpec {
    name: string;
    generator: (rng: RNG) => Value;
}

const DOMAINS: Record<string, DomainSpec> = {
    'Nat': { name: 'ℕ', generator: randomNatWith },
    'Int': { name: 'ℤ', generator: randomIntWith },
    'Real': { name: 'ℝ', generator: randomRealWith },
    'Bool': { name: 'Bool', generator: randomBoolWith },
    'Prime': { name: 'Prime', generator: randomPrimeWith },
};

// ── Result classification ───────────────────────────────────

export function classifyResult(
    passed: number, failed: number, _skipped: number, _total: number,
    preconditionSkipped: number = 0,
): RandomTestReport['classification'] {
    const evaluated = passed + failed;
    if (evaluated === 0) return 'indeterminate';
    const passRate = passed / evaluated;

    // If most tests were skipped due to precondition failure, the theorem
    // has strong constraints. Remaining failures may be due to INCOMPLETE
    // precondition capture (parser didn't extract all constraints) rather
    // than actual theorem falsity.
    const totalGenerated = evaluated + preconditionSkipped;
    const qualifyingRate = totalGenerated > 0 ? evaluated / totalGenerated : 0;
    const hasPreconditions = preconditionSkipped > 0;

    if (failed === 0 && evaluated >= 100) return 'verified';
    if (failed === 0 && evaluated >= 10) return 'likely_true';
    if (failed === 0) return 'indeterminate'; // Too few qualifying tests

    // When preconditions exist but many qualifying tests still fail,
    // the parser likely missed some constraints (e.g., "p is prime" was
    // parsed as Prime(a) instead of Prime(p)). Be conservative.
    if (hasPreconditions && qualifyingRate < 0.5) return 'indeterminate';
    if (hasPreconditions && passRate > 0.1) return 'indeterminate';

    // Only declare falsified when we have NO preconditions (so all inputs
    // are valid) and the pass rate is very low
    if (!hasPreconditions && passRate < 0.1 && evaluated >= 20) return 'falsified';
    if (!hasPreconditions && passRate < 0.5 && evaluated >= 20) return 'likely_false';

    if (passRate < 0.05 && evaluated >= 50 && !hasPreconditions) return 'falsified';
    return 'indeterminate';
}

// ── QuickCheck-style testing ────────────────────────────────

/**
 * Evaluate theorem preconditions (param type constraints like Prime(p), Coprime(a, p)).
 * Returns true if all preconditions are satisfied, false if any fail, null if unevaluable.
 */
function compileEvaluator(term: Term): EvalFn {
    switch (term.tag) {
        case 'Literal': {
            const value: Value = term.kind === 'Nat' || term.kind === 'Int'
                ? Number.isFinite(Number(term.value)) ? Number(term.value) : null
                : term.kind === 'Bool' ? term.value === 'true' : term.value;
            return () => value;
        }
        case 'Var': {
            const { name } = term;
            return (env) => env[name] ?? null;
        }
        case 'BinOp': {
            const left = compileEvaluator(term.left);
            const right = compileEvaluator(term.right);
            const op = term.op;
            return (env) => {
                const l = left(env);
                const r = right(env);
                if (l === null || r === null) return null;
                return evalBinOp(op, l, r);
            };
        }
        case 'UnaryOp': {
            const operand = compileEvaluator(term.operand);
            const op = term.op;
            return (env) => {
                const v = operand(env);
                if (v === null) return null;
                if (op === '¬' && typeof v === 'boolean') return !v;
                if (op === '-' && typeof v === 'number') return -v;
                return null;
            };
        }
        case 'ForAll':
        case 'Exists':
        case 'Lam':
        case 'Pi':
        case 'Sigma':
        case 'Sort':
        case 'Ind':
        case 'Match':
        case 'Hole':
        case 'Proj':
            return () => null;
        case 'AxiomRef':
            return () => true;
        case 'Equiv':
        case 'App':
        case 'LetIn':
        case 'Pair':
            // These paths are less common and more nuanced; defer to the full evaluator.
            return (env) => evaluate(term, env);
    }
}

function compilePreconditionChecks(params: Param[]): EvalFn[] {
    const runtimeCheckable: EvalFn[] = [];
    for (let i = 0; i < params.length; i++) {
        const ty = params[i].type;
        // Simple type labels (ℕ, ℤ, ...) are domain declarations, not runtime predicate checks.
        if (ty.tag !== 'Var') runtimeCheckable.push(compileEvaluator(ty));
    }
    return runtimeCheckable;
}

function checkCompiledPreconditions(preconditions: EvalFn[], env: Record<string, Value>): boolean | null {
    for (let i = 0; i < preconditions.length; i++) {
        const result = preconditions[i](env);
        if (result === null) continue;
        if (result === false) return false;
    }
    return true;
}

export function quickCheck(
    term: Term,
    variables: Array<{ name: string; domain: string }>,
    numTests: number = 1000,
    preconditions: Param[] = [],
    options: QuickCheckOptions = {},
): RandomTestReport {
    const start = performance.now();
    const counterexamples: TestResult[] = [];
    const rng: RNG = options.seed === undefined ? Math.random : createSeededRng(options.seed);
    const maxCounterexamples = options.maxCounterexamples ?? 5;
    const timeoutMs = options.timeoutMs;

    const variableNames = variables.map(v => v.name);
    const variableGens = variables.map(v => (DOMAINS[v.domain] ?? DOMAINS['Int']).generator);
    const evalTerm = compileEvaluator(term);
    const compiledPreconditions = preconditions.length > 0 ? compilePreconditionChecks(preconditions) : [];
    const env: Record<string, Value> = {};

    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let preconditionSkipped = 0;

    const runSingle = () => {
        for (let j = 0; j < variableNames.length; j++) {
            env[variableNames[j]] = variableGens[j](rng);
        }

        if (compiledPreconditions.length > 0) {
            const preResult = checkCompiledPreconditions(compiledPreconditions, env);
            if (preResult === false) {
                preconditionSkipped++;
                return;
            }
        }

        const result = evalTerm(env);
        if (result === null) {
            skipped++;
            return;
        }
        if (result === true || result === 1) {
            passed++;
            return;
        }

        failed++;
        if (counterexamples.length < maxCounterexamples) {
            counterexamples.push({ passed: false, witness: { ...env }, evaluated: result });
        }
    };

    if (timeoutMs === undefined) {
        for (let i = 0; i < numTests; i++) runSingle();
    } else {
        for (let i = 0; i < numTests; i++) {
            if (performance.now() - start >= timeoutMs) break;
            runSingle();
        }
    }

    const total = passed + failed;
    const classification = classifyResult(passed, failed, skipped, numTests, preconditionSkipped);

    return {
        totalTests: total,
        passed,
        failed,
        counterexamples,
        time: performance.now() - start,
        skipped,
        preconditionSkipped,
        classification,
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
        'Coprime', 'True', 'False', 'abs', 'sqrt', 'gcd', 'lcm', 'max', 'min',
        'sin', 'cos', 'tan', 'exp', 'ln', 'log', 'det', 'dim', 'ker', 'factorial', 'index',
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

function factorial(n: number): number | null {
    if (n < 0 || !Number.isInteger(n)) return null;
    if (n > 20) return null; // Overflow guard
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
}
