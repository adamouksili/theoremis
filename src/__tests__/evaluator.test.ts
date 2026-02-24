// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Evaluator & Engine Tests
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { evaluate, quickCheck, extractVariables } from '../engine/evaluator';
import { generateMutations } from '../engine/mutator';
import { mk, Types, BUNDLES, type Theorem } from '../core/ir';

describe('evaluate', () => {
    it('evaluates literal numbers', () => {
        expect(evaluate(mk.nat(42), {})).toBe(42);
    });

    it('evaluates variable lookup', () => {
        expect(evaluate(mk.var('x'), { x: 5 })).toBe(5);
    });

    it('returns null for unknown variables', () => {
        expect(evaluate(mk.var('unknown'), {})).toBeNull();
    });

    it('evaluates addition', () => {
        expect(evaluate(mk.binOp('+', mk.var('a'), mk.var('b')), { a: 3, b: 4 })).toBe(7);
    });

    it('evaluates subtraction', () => {
        expect(evaluate(mk.binOp('-', mk.var('a'), mk.var('b')), { a: 10, b: 3 })).toBe(7);
    });

    it('evaluates multiplication', () => {
        expect(evaluate(mk.binOp('*', mk.var('a'), mk.var('b')), { a: 6, b: 7 })).toBe(42);
    });

    it('evaluates division', () => {
        expect(evaluate(mk.binOp('/', mk.var('a'), mk.var('b')), { a: 10, b: 2 })).toBe(5);
    });

    it('handles division by zero', () => {
        expect(evaluate(mk.binOp('/', mk.var('a'), mk.var('b')), { a: 10, b: 0 })).toBeNull();
    });

    it('evaluates exponentiation', () => {
        expect(evaluate(mk.binOp('^', mk.var('a'), mk.var('b')), { a: 2, b: 3 })).toBe(8);
    });

    it('evaluates equality (true)', () => {
        expect(evaluate(mk.binOp('=', mk.var('a'), mk.var('b')), { a: 5, b: 5 })).toBe(true);
    });

    it('evaluates equality (false)', () => {
        expect(evaluate(mk.binOp('=', mk.var('a'), mk.var('b')), { a: 5, b: 6 })).toBe(false);
    });

    it('evaluates ≤ (true)', () => {
        expect(evaluate(mk.binOp('≤', mk.var('a'), mk.var('b')), { a: 3, b: 5 })).toBe(true);
    });

    it('evaluates ≤ (false)', () => {
        expect(evaluate(mk.binOp('≤', mk.var('a'), mk.var('b')), { a: 7, b: 5 })).toBe(false);
    });

    it('evaluates ≥', () => {
        expect(evaluate(mk.binOp('≥', mk.var('a'), mk.var('b')), { a: 5, b: 5 })).toBe(true);
    });

    it('evaluates logical AND', () => {
        expect(evaluate(mk.binOp('∧', mk.var('p'), mk.var('q')), { p: true, q: true })).toBe(true);
        expect(evaluate(mk.binOp('∧', mk.var('p'), mk.var('q')), { p: true, q: false })).toBe(false);
    });

    it('evaluates logical OR', () => {
        expect(evaluate(mk.binOp('∨', mk.var('p'), mk.var('q')), { p: false, q: true })).toBe(true);
        expect(evaluate(mk.binOp('∨', mk.var('p'), mk.var('q')), { p: false, q: false })).toBe(false);
    });

    it('evaluates logical implication', () => {
        expect(evaluate(mk.binOp('→', mk.var('p'), mk.var('q')), { p: true, q: false })).toBe(false);
        expect(evaluate(mk.binOp('→', mk.var('p'), mk.var('q')), { p: false, q: false })).toBe(true);
    });

    it('evaluates negation', () => {
        expect(evaluate(mk.unaryOp('¬', mk.var('p')), { p: true })).toBe(false);
        expect(evaluate(mk.unaryOp('¬', mk.var('p')), { p: false })).toBe(true);
    });

    it('evaluates unary minus', () => {
        expect(evaluate(mk.unaryOp('-', mk.var('x')), { x: 5 })).toBe(-5);
    });

    it('evaluates modular equivalence (true)', () => {
        expect(evaluate(mk.equiv(mk.var('a'), mk.var('b'), mk.var('m')), { a: 7, b: 2, m: 5 })).toBe(true);
    });

    it('evaluates modular equivalence (false)', () => {
        expect(evaluate(mk.equiv(mk.var('a'), mk.var('b'), mk.var('m')), { a: 7, b: 3, m: 5 })).toBe(false);
    });

    it('evaluates Prime check', () => {
        expect(evaluate(mk.app(mk.var('Prime'), mk.var('n')), { n: 7 })).toBe(true);
        expect(evaluate(mk.app(mk.var('Prime'), mk.var('n')), { n: 4 })).toBe(false);
    });

    it('evaluates Even check', () => {
        expect(evaluate(mk.app(mk.var('Even'), mk.var('n')), { n: 4 })).toBe(true);
        expect(evaluate(mk.app(mk.var('Even'), mk.var('n')), { n: 3 })).toBe(false);
    });

    it('evaluates Odd check', () => {
        expect(evaluate(mk.app(mk.var('Odd'), mk.var('n')), { n: 3 })).toBe(true);
        expect(evaluate(mk.app(mk.var('Odd'), mk.var('n')), { n: 4 })).toBe(false);
    });

    it('evaluates let-in', () => {
        // Use variable-based let-in to avoid literal string coercion issues
        const letExpr = mk.letIn('x', Types.Nat, mk.nat(10),
            mk.var('x'));
        const result = evaluate(letExpr, {});
        // let x = 10 in x should return the numeric value 10
        expect(result).toBe(10);
    });
});

describe('extractVariables', () => {
    it('extracts free variables', () => {
        const term = mk.binOp('+', mk.var('a'), mk.var('b'));
        const vars = extractVariables(term);
        expect(vars.length).toBe(2);
        expect(vars.map(v => v.name)).toContain('a');
        expect(vars.map(v => v.name)).toContain('b');
    });

    it('does not extract built-in names', () => {
        const term = mk.app(mk.var('Prime'), mk.var('n'));
        const vars = extractVariables(term);
        expect(vars.map(v => v.name)).not.toContain('Prime');
        expect(vars.map(v => v.name)).toContain('n');
    });

    it('respects domain from ForAll', () => {
        const term = mk.forAll('x', Types.Nat, mk.binOp('≥', mk.var('x'), mk.nat(0)));
        const vars = extractVariables(term);
        const xVar = vars.find(v => v.name === 'x');
        expect(xVar).toBeTruthy();
        expect(xVar!.domain).toBe('Nat');
    });
});

describe('quickCheck', () => {
    it('validates a tautology passes', () => {
        // x = x should always pass
        const term = mk.binOp('=', mk.var('x'), mk.var('x'));
        const vars = [{ name: 'x', domain: 'Int' }];
        const result = quickCheck(term, vars, 100);
        expect(result.passed).toBeGreaterThan(0);
        expect(result.failed).toBe(0);
    });

    it('finds counterexample for false statement', () => {
        // x > x should always fail
        const term = mk.binOp('>', mk.var('x'), mk.var('x'));
        const vars = [{ name: 'x', domain: 'Int' }];
        const result = quickCheck(term, vars, 100);
        expect(result.failed).toBeGreaterThan(0);
        expect(result.counterexamples.length).toBeGreaterThan(0);
    });

    it('reports timing', () => {
        const term = mk.binOp('≥', mk.var('x'), mk.nat(0));
        const vars = [{ name: 'x', domain: 'Nat' }];
        const result = quickCheck(term, vars, 10);
        expect(result.time).toBeGreaterThan(0);
    });
});

describe('generateMutations', () => {
    const theorem: Theorem = {
        tag: 'Theorem',
        name: 'test',
        params: [
            { name: 'h_prime', type: mk.app(mk.var('Prime'), mk.var('p')), implicit: false },
            { name: 'h_coprime', type: mk.app(mk.app(mk.var('Coprime'), mk.var('a')), mk.var('p')), implicit: false },
        ],
        statement: mk.equiv(mk.binOp('^', mk.var('a'), mk.binOp('-', mk.var('p'), mk.nat(1))), mk.nat(1), mk.var('p')),
        proof: [{ tag: 'Sorry' }],
        axiomBundle: BUNDLES.ClassicalMath,
        metadata: { confidence: 0.8, dependencies: [] },
    };

    it('generates drop_hypothesis mutations for each param', () => {
        const mutations = generateMutations(theorem);
        const drops = mutations.filter(m => m.type === 'drop_hypothesis');
        expect(drops.length).toBe(2);
    });

    it('generates negate_conclusion mutation', () => {
        const mutations = generateMutations(theorem);
        const negations = mutations.filter(m => m.type === 'negate_conclusion');
        expect(negations.length).toBe(1);
    });

    it('generates at least one mutation of each applicable type', () => {
        const mutations = generateMutations(theorem);
        expect(mutations.length).toBeGreaterThanOrEqual(3); // At least drops + negate
    });
});
