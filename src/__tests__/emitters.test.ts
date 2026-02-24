// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Emitter Tests
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { emitLean4 } from '../emitters/lean4';
import { emitCoq } from '../emitters/coq';
import { emitIsabelle } from '../emitters/isabelle';
import { mk, Types, BUNDLES, type IRModule, type Theorem, type Definition } from '../core/ir';

function makeModule(declarations: IRModule['declarations']): IRModule {
    return { name: 'test', declarations, axiomBundle: BUNDLES.ClassicalMath, imports: [] };
}

const simpleThm: Theorem = {
    tag: 'Theorem',
    name: 'test_thm',
    params: [{ name: 'n', type: Types.Nat, implicit: false }],
    statement: mk.binOp('≥', mk.var('n'), mk.nat(0)),
    proof: [{ tag: 'Omega' }],
    axiomBundle: BUNDLES.ClassicalMath,
    metadata: { confidence: 1.0, dependencies: [] },
};

const simpleDef: Definition = {
    tag: 'Definition',
    name: 'double',
    params: [{ name: 'n', type: Types.Nat, implicit: false }],
    returnType: Types.Nat,
    body: mk.binOp('*', mk.nat(2), mk.var('n')),
};

describe('Lean 4 emitter', () => {
    it('emits valid Lean 4 code', () => {
        const result = emitLean4(makeModule([simpleThm]));
        expect(result.language).toBe('lean4');
        expect(result.fileExtension).toBe('.lean');
        expect(result.code).toContain('theorem test_thm');
        expect(result.code).toContain('omega');
    });

    it('emits definitions', () => {
        const result = emitLean4(makeModule([simpleDef]));
        expect(result.code).toContain('def double');
    });

    it('includes Mathlib imports', () => {
        const result = emitLean4(makeModule([simpleThm]));
        expect(result.code).toContain('import Mathlib');
    });

    it('maps types correctly', () => {
        const result = emitLean4(makeModule([simpleThm]));
        expect(result.code).toContain('Nat');
    });

    it('handles sorry in proofs', () => {
        const thmWithSorry: Theorem = {
            ...simpleThm,
            proof: [{ tag: 'Sorry' }],
        };
        const result = emitLean4(makeModule([thmWithSorry]));
        expect(result.code).toContain('sorry');
    });
});

describe('Coq emitter', () => {
    it('emits valid Coq code', () => {
        const result = emitCoq(makeModule([simpleThm]));
        expect(result.language).toBe('coq');
        expect(result.fileExtension).toBe('.v');
        expect(result.code).toContain('Theorem test_thm');
        expect(result.code).toContain('Qed.');
    });

    it('emits definitions', () => {
        const result = emitCoq(makeModule([simpleDef]));
        expect(result.code).toContain('Definition double');
    });

    it('includes required imports', () => {
        const result = emitCoq(makeModule([simpleThm]));
        expect(result.code).toContain('Require Import');
    });
});

describe('Isabelle emitter', () => {
    it('emits valid Isabelle code', () => {
        const result = emitIsabelle(makeModule([simpleThm]));
        expect(result.language).toBe('isabelle');
        expect(result.fileExtension).toBe('.thy');
        expect(result.code).toContain('theorem test_thm');
        expect(result.code).toContain('theory');
        expect(result.code).toContain('end');
    });

    it('emits definitions', () => {
        const result = emitIsabelle(makeModule([simpleDef]));
        expect(result.code).toContain('definition double');
    });

    it('includes dependent type warning', () => {
        const result = emitIsabelle(makeModule([simpleThm]));
        expect(result.warnings.some(w => w.includes('Dependent types'))).toBe(true);
    });
});

// ── Round-trip / snapshot consistency tests ──────────────────

describe('Emitter round-trip consistency', () => {
    it('all three emitters produce output for the same IR module', () => {
        const mod = makeModule([simpleThm, simpleDef]);
        const lean4 = emitLean4(mod);
        const coq = emitCoq(mod);
        const isabelle = emitIsabelle(mod);

        expect(lean4.code.length).toBeGreaterThan(0);
        expect(coq.code.length).toBeGreaterThan(0);
        expect(isabelle.code.length).toBeGreaterThan(0);
    });

    it('emitters are deterministic (same IR → same output)', () => {
        const mod = makeModule([simpleThm, simpleDef]);
        const lean4a = emitLean4(mod);
        const lean4b = emitLean4(mod);
        expect(lean4a.code).toBe(lean4b.code);

        const coqA = emitCoq(mod);
        const coqB = emitCoq(mod);
        expect(coqA.code).toBe(coqB.code);

        const isaA = emitIsabelle(mod);
        const isaB = emitIsabelle(mod);
        expect(isaA.code).toBe(isaB.code);
    });

    it('sorry holes propagate to all backends', () => {
        const sorryThm: Theorem = {
            ...simpleThm,
            name: 'has_sorry',
            proof: [{ tag: 'Sorry' }],
        };
        const mod = makeModule([sorryThm]);
        const lean4 = emitLean4(mod);
        const coq = emitCoq(mod);
        const isabelle = emitIsabelle(mod);

        expect(lean4.code).toContain('sorry');
        expect(coq.code).toContain('admit');
        expect(isabelle.code).toContain('sorry');
    });

    it('theorem names are preserved across backends', () => {
        const mod = makeModule([simpleThm]);
        const lean4 = emitLean4(mod);
        const coq = emitCoq(mod);
        const isabelle = emitIsabelle(mod);

        expect(lean4.code).toContain('test_thm');
        expect(coq.code).toContain('test_thm');
        expect(isabelle.code).toContain('test_thm');
    });

    it('definition names are preserved across backends', () => {
        const mod = makeModule([simpleDef]);
        const lean4 = emitLean4(mod);
        const coq = emitCoq(mod);
        const isabelle = emitIsabelle(mod);

        expect(lean4.code).toContain('double');
        expect(coq.code).toContain('double');
        expect(isabelle.code).toContain('double');
    });

    it('complex IR produces syntactically valid output in all backends', () => {
        const complexThm: Theorem = {
            tag: 'Theorem',
            name: 'complex_thm',
            params: [
                { name: 'n', type: Types.Nat, implicit: false },
                { name: 'm', type: Types.Nat, implicit: false },
            ],
            statement: mk.binOp('=', mk.binOp('+', mk.var('n'), mk.var('m')), mk.binOp('+', mk.var('m'), mk.var('n'))),
            proof: [{ tag: 'Ring' }],
            axiomBundle: BUNDLES.ClassicalMath,
            metadata: { confidence: 1.0, dependencies: [] },
        };
        const mod = makeModule([complexThm]);
        const lean4 = emitLean4(mod);
        const coq = emitCoq(mod);
        const isabelle = emitIsabelle(mod);

        // Lean 4 should have proper structure
        expect(lean4.code).toContain('theorem complex_thm');
        expect(lean4.code).toContain('ring');

        // Coq should close proofs
        expect(coq.code).toContain('Theorem complex_thm');
        expect(coq.code).toContain('Qed.');

        // Isabelle should wrap in theory
        expect(isabelle.code).toContain('theorem complex_thm');
        expect(isabelle.code).toContain('theory');
        expect(isabelle.code).toContain('end');
    });
});
