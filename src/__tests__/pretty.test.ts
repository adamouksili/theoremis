// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Pretty Printer Tests
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { prettyTerm, prettyTactic, prettyModule } from '../core/pretty';
import { mk, Types, BUNDLES, type IRModule } from '../core/ir';

describe('prettyTerm', () => {
    it('prints variables', () => {
        expect(prettyTerm(mk.var('x'))).toBe('x');
    });

    it('prints natural number literals', () => {
        expect(prettyTerm(mk.nat(42))).toBe('42');
    });

    it('prints boolean literals', () => {
        expect(prettyTerm(mk.bool(true))).toBe('true');
    });

    it('prints lambda', () => {
        const t = mk.lam('x', Types.Nat, mk.var('x'));
        expect(prettyTerm(t)).toContain('λ');
        expect(prettyTerm(t)).toContain('x');
    });

    it('prints application', () => {
        const t = mk.app(mk.var('f'), mk.var('x'));
        expect(prettyTerm(t)).toBe('(f x)');
    });

    it('prints Pi (non-dependent arrow)', () => {
        const t = mk.arrow(Types.Nat, Types.Bool);
        expect(prettyTerm(t)).toContain('→');
    });

    it('prints Pi (dependent)', () => {
        const t = mk.pi('x', Types.Nat, mk.var('x'));
        expect(prettyTerm(t)).toContain('Π');
    });

    it('prints Sigma', () => {
        const t = mk.sigma('x', Types.Nat, mk.var('x'));
        expect(prettyTerm(t)).toContain('Σ');
    });

    it('prints Pair', () => {
        const t = mk.pair(mk.nat(1), mk.nat(2));
        expect(prettyTerm(t)).toContain('⟨');
    });

    it('prints Sort Prop', () => {
        expect(prettyTerm(Types.Prop)).toBe('Prop');
    });

    it('prints Sort Type', () => {
        expect(prettyTerm(Types.Type0)).toBe('Type 0');
    });

    it('prints Hole', () => {
        expect(prettyTerm(mk.hole('goal1'))).toBe('?goal1');
    });

    it('prints BinOp', () => {
        const t = mk.binOp('+', mk.var('a'), mk.var('b'));
        expect(prettyTerm(t)).toBe('(a + b)');
    });

    it('prints negation', () => {
        const t = mk.unaryOp('¬', mk.var('P'));
        expect(prettyTerm(t)).toBe('(¬P)');
    });

    it('prints Equiv with modulus', () => {
        const t = mk.equiv(mk.var('a'), mk.nat(1), mk.var('p'));
        expect(prettyTerm(t)).toContain('≡');
        expect(prettyTerm(t)).toContain('MOD');
    });

    it('prints ForAll', () => {
        const t = mk.forAll('x', Types.Nat, mk.binOp('≥', mk.var('x'), mk.nat(0)));
        expect(prettyTerm(t)).toContain('∀');
    });

    it('prints Exists', () => {
        const t = mk.exists('x', Types.Nat, mk.binOp('>', mk.var('x'), mk.nat(0)));
        expect(prettyTerm(t)).toContain('∃');
    });
});

describe('prettyTactic', () => {
    it('prints intro', () => {
        expect(prettyTactic({ tag: 'Intro', names: ['h1', 'h2'] })).toContain('intro h1 h2');
    });

    it('prints sorry', () => {
        expect(prettyTactic({ tag: 'Sorry' })).toContain('sorry');
    });

    it('prints omega', () => {
        expect(prettyTactic({ tag: 'Omega' })).toContain('omega');
    });

    it('prints ring', () => {
        expect(prettyTactic({ tag: 'Ring' })).toContain('ring');
    });

    it('prints simp with lemmas', () => {
        expect(prettyTactic({ tag: 'Simp', lemmas: ['add_comm', 'mul_comm'] })).toContain('add_comm');
    });

    it('prints induction', () => {
        expect(prettyTactic({ tag: 'Induction', name: 'n' })).toContain('induction n');
    });
});

describe('prettyModule', () => {
    it('prints a full module', () => {
        const mod: IRModule = {
            name: 'TestModule',
            declarations: [{
                tag: 'Theorem',
                name: 'test',
                params: [],
                statement: mk.binOp('=', mk.nat(1), mk.nat(1)),
                proof: [{ tag: 'Sorry' }],
                axiomBundle: BUNDLES.ClassicalMath,
                metadata: { confidence: 1.0, dependencies: [] },
            }],
            axiomBundle: BUNDLES.ClassicalMath,
            imports: [],
        };
        const output = prettyModule(mod);
        expect(output).toContain('Module: TestModule');
        expect(output).toContain('theorem test');
    });
});
