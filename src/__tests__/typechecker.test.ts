// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Type-Checker Tests
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { typeCheck, substitute, termsEqual, freeVars } from '../core/typechecker';
import { mk, Types, BUNDLES, type IRModule } from '../core/ir';

function makeModule(declarations: IRModule['declarations']): IRModule {
    return {
        name: 'test',
        declarations,
        axiomBundle: BUNDLES.ClassicalMath,
        imports: [],
    };
}

describe('substitute', () => {
    it('substitutes a variable', () => {
        const result = substitute(mk.var('x'), 'x', mk.nat(42));
        expect(result.tag).toBe('Literal');
        if (result.tag === 'Literal') expect(result.value).toBe('42');
    });

    it('does not substitute bound variables', () => {
        const lam = mk.lam('x', Types.Nat, mk.var('x'));
        const result = substitute(lam, 'x', mk.nat(42));
        // The body should remain mk.var('x') because x is bound
        if (result.tag === 'Lam') {
            expect(result.body.tag).toBe('Var');
        }
    });

    it('substitutes free variables in lambda body', () => {
        const lam = mk.lam('x', Types.Nat, mk.var('y'));
        const result = substitute(lam, 'y', mk.nat(7));
        if (result.tag === 'Lam') {
            expect(result.body.tag).toBe('Literal');
        }
    });

    it('substitutes in binary operations', () => {
        const expr = mk.binOp('+', mk.var('a'), mk.var('b'));
        const result = substitute(expr, 'a', mk.nat(1));
        if (result.tag === 'BinOp') {
            expect(result.left.tag).toBe('Literal');
            expect(result.right.tag).toBe('Var');
        }
    });

    it('substitutes in ForAll', () => {
        const forall = mk.forAll('x', Types.Nat, mk.var('y'));
        const result = substitute(forall, 'y', mk.nat(5));
        if (result.tag === 'ForAll') {
            expect(result.body.tag).toBe('Literal');
        }
    });

    it('does not substitute bound var in ForAll', () => {
        const forall = mk.forAll('x', Types.Nat, mk.var('x'));
        const result = substitute(forall, 'x', mk.nat(5));
        if (result.tag === 'ForAll') {
            expect(result.body.tag).toBe('Var');
        }
    });

    it('avoids variable capture in lambda', () => {
        // (λ y. x)[x := y] should NOT produce (λ y. y)
        // It should rename the binder: (λ y′. y)
        const lam = mk.lam('y', Types.Nat, mk.var('x'));
        const result = substitute(lam, 'x', mk.var('y'));
        expect(result.tag).toBe('Lam');
        if (result.tag === 'Lam') {
            // Binder must have been renamed to avoid capture
            expect(result.param).not.toBe('y');
            // Body should be the replacement (y), not the renamed binder
            expect(result.body.tag).toBe('Var');
            if (result.body.tag === 'Var') {
                expect(result.body.name).toBe('y');
            }
        }
    });

    it('avoids variable capture in Pi', () => {
        // (Π y : ℕ. x)[x := y] should rename the binder
        const pi = mk.pi('y', Types.Nat, mk.var('x'));
        const result = substitute(pi, 'x', mk.var('y'));
        expect(result.tag).toBe('Pi');
        if (result.tag === 'Pi') {
            expect(result.param).not.toBe('y');
            if (result.body.tag === 'Var') {
                expect(result.body.name).toBe('y');
            }
        }
    });

    it('avoids variable capture in ForAll', () => {
        // (∀ y ∈ ℕ. x = y)[x := y] should rename the binder
        const forall = mk.forAll('y', Types.Nat, mk.binOp('=', mk.var('x'), mk.var('y')));
        const result = substitute(forall, 'x', mk.var('y'));
        expect(result.tag).toBe('ForAll');
        if (result.tag === 'ForAll') {
            expect(result.param).not.toBe('y');
        }
    });

    it('does not rename when no capture risk', () => {
        // (λ y. x)[x := z] — no capture risk, binder should stay y
        const lam = mk.lam('y', Types.Nat, mk.var('x'));
        const result = substitute(lam, 'x', mk.var('z'));
        expect(result.tag).toBe('Lam');
        if (result.tag === 'Lam') {
            expect(result.param).toBe('y');
            if (result.body.tag === 'Var') {
                expect(result.body.name).toBe('z');
            }
        }
    });
});

describe('freeVars', () => {
    it('finds free variables in a term', () => {
        const term = mk.binOp('+', mk.var('a'), mk.var('b'));
        const fv = freeVars(term);
        expect(fv.has('a')).toBe(true);
        expect(fv.has('b')).toBe(true);
    });

    it('excludes bound variables in lambda', () => {
        const lam = mk.lam('x', Types.Nat, mk.binOp('+', mk.var('x'), mk.var('y')));
        const fv = freeVars(lam);
        expect(fv.has('x')).toBe(false);
        expect(fv.has('y')).toBe(true);
    });

    it('excludes bound variables in ForAll', () => {
        const forall = mk.forAll('n', Types.Nat, mk.binOp('≥', mk.var('n'), mk.nat(0)));
        const fv = freeVars(forall);
        expect(fv.has('n')).toBe(false);
    });

    it('returns empty for literals', () => {
        expect(freeVars(mk.nat(42)).size).toBe(0);
    });

    it('includes domain variables in ℕ references', () => {
        const fv = freeVars(mk.var('ℕ'));
        expect(fv.has('ℕ')).toBe(true);
    });
});

describe('termsEqual', () => {
    it('compares equal variables', () => {
        expect(termsEqual(mk.var('x'), mk.var('x'))).toBe(true);
    });

    it('compares unequal variables', () => {
        expect(termsEqual(mk.var('x'), mk.var('y'))).toBe(false);
    });

    it('compares literals', () => {
        expect(termsEqual(mk.nat(42), mk.nat(42))).toBe(true);
        expect(termsEqual(mk.nat(42), mk.nat(43))).toBe(false);
    });

    it('compares sorts', () => {
        expect(termsEqual(Types.Prop, Types.Prop)).toBe(true);
        expect(termsEqual(Types.Type0, Types.Type0)).toBe(true);
        expect(termsEqual(Types.Prop, Types.Type0)).toBe(false);
    });

    it('compares binary ops', () => {
        const a = mk.binOp('+', mk.var('x'), mk.var('y'));
        const b = mk.binOp('+', mk.var('x'), mk.var('y'));
        expect(termsEqual(a, b)).toBe(true);
    });

    it('compares different ops', () => {
        const a = mk.binOp('+', mk.var('x'), mk.var('y'));
        const b = mk.binOp('-', mk.var('x'), mk.var('y'));
        expect(termsEqual(a, b)).toBe(false);
    });
});

describe('typeCheck', () => {
    it('type-checks a simple definition', () => {
        const mod = makeModule([{
            tag: 'Definition',
            name: 'mydef',
            params: [],
            returnType: Types.Nat,
            body: mk.nat(42),
        }]);
        const result = typeCheck(mod);
        expect(result.valid).toBe(true);
        expect(result.diagnostics.some(d => d.severity === 'info')).toBe(true);
    });

    it('reports sorry in theorems', () => {
        const mod = makeModule([{
            tag: 'Theorem',
            name: 'test_thm',
            params: [],
            statement: mk.binOp('=', mk.nat(1), mk.nat(1)),
            proof: [{ tag: 'Sorry' }],
            axiomBundle: BUNDLES.ClassicalMath,
            metadata: { confidence: 1.0, dependencies: [] },
        }]);
        const result = typeCheck(mod);
        expect(result.diagnostics.some(d =>
            d.severity === 'warning' && d.message.includes('sorry')
        )).toBe(true);
    });

    it('detects unbound variables', () => {
        const mod = makeModule([{
            tag: 'Definition',
            name: 'bad',
            params: [],
            returnType: Types.Type0,
            body: mk.var('nonexistent_var_xyz'),
        }]);
        const result = typeCheck(mod);
        expect(result.diagnostics.some(d =>
            d.severity === 'error' && d.message.includes('Unbound variable')
        )).toBe(true);
    });

    it('tracks axiom usage', () => {
        const mod = makeModule([{
            tag: 'Theorem',
            name: 'classical',
            params: [],
            statement: mk.binOp('=', mk.axiomRef('LEM'), mk.axiomRef('LEM')),
            proof: [{ tag: 'Sorry' }],
            axiomBundle: BUNDLES.ClassicalMath,
            metadata: { confidence: 1.0, dependencies: [] },
        }]);
        const result = typeCheck(mod);
        expect(result.axiomUsage.has('LEM')).toBe(true);
    });

    it('records holes', () => {
        const mod = makeModule([{
            tag: 'Definition',
            name: 'holey',
            params: [],
            returnType: Types.Type0,
            body: mk.hole('test_hole'),
        }]);
        const result = typeCheck(mod);
        expect(result.holes.length).toBe(1);
        expect(result.holes[0].id).toBe('test_hole');
    });

    it('infers type of BinOp equality as Prop', () => {
        const mod = makeModule([{
            tag: 'Theorem',
            name: 'eq_thm',
            params: [],
            statement: mk.binOp('=', mk.nat(1), mk.nat(1)),
            proof: [{ tag: 'Sorry' }],
            axiomBundle: BUNDLES.ClassicalMath,
            metadata: { confidence: 1.0, dependencies: [] },
        }]);
        const result = typeCheck(mod);
        // Statement should be well-formed with type Prop
        expect(result.diagnostics.some(d =>
            d.severity === 'info' && d.message.includes('propositional')
        )).toBe(true);
    });

    it('handles ForAll properly', () => {
        const mod = makeModule([{
            tag: 'Theorem',
            name: 'forall_thm',
            params: [],
            statement: mk.forAll('x', Types.Nat, mk.binOp('≥', mk.var('x'), mk.nat(0))),
            proof: [{ tag: 'Sorry' }],
            axiomBundle: BUNDLES.ClassicalMath,
            metadata: { confidence: 1.0, dependencies: [] },
        }]);
        const result = typeCheck(mod);
        expect(result.valid).toBe(true);
    });
});
