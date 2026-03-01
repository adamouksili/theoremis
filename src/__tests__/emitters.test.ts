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

// ── Extended emitter validation tests ───────────────────────

describe('Lean 4 emitter: extended validation', () => {
    it('emits theorem with parameters, quantifiers, and sorry proof', () => {
        const thm: Theorem = {
            tag: 'Theorem',
            name: 'forall_thm',
            params: [
                { name: 'n', type: Types.Nat, implicit: false },
                { name: 'p', type: mk.app(mk.var('Prime'), mk.var('n')), implicit: false },
            ],
            statement: mk.forAll('a', Types.Int, mk.binOp('≥', mk.var('a'), mk.nat(0))),
            proof: [{ tag: 'Sorry' }],
            axiomBundle: BUNDLES.ClassicalMath,
            metadata: { confidence: 0.5, dependencies: [] },
        };
        const result = emitLean4(makeModule([thm]));
        expect(result.code).toContain('theorem forall_thm');
        expect(result.code).toContain('sorry');
        expect(result.code).toContain(':=');
        expect(result.code).toContain('by');
        // Should have proper parameter syntax
        expect(result.code).toMatch(/\(n : Nat\)/);
    });

    it('emits definition with lambda body', () => {
        const def: Definition = {
            tag: 'Definition',
            name: 'add_one',
            params: [],
            returnType: mk.arrow(Types.Nat, Types.Nat),
            body: mk.lam('x', Types.Nat, mk.binOp('+', mk.var('x'), mk.nat(1))),
        };
        const result = emitLean4(makeModule([def]));
        expect(result.code).toContain('def add_one');
        expect(result.code).toContain('fun');
        expect(result.code).toContain('=>');
        expect(result.code).toContain(':=');
    });

    it('emits theorem with modular equivalence', () => {
        const thm: Theorem = {
            tag: 'Theorem',
            name: 'mod_equiv_thm',
            params: [
                { name: 'a', type: Types.Int, implicit: false },
                { name: 'p', type: Types.Nat, implicit: false },
            ],
            statement: mk.equiv(
                mk.binOp('^', mk.var('a'), mk.binOp('-', mk.var('p'), mk.nat(1))),
                mk.nat(1),
                mk.var('p')
            ),
            proof: [{ tag: 'Sorry' }],
            axiomBundle: BUNDLES.ClassicalMath,
            metadata: { confidence: 0.8, dependencies: [] },
        };
        const result = emitLean4(makeModule([thm]));
        expect(result.code).toContain('Int.ModEq');
        expect(result.code).toContain('mod_equiv_thm');
    });

    it('emits inductive type definition via term', () => {
        const indTerm = mk.ind('MyNat', mk.sort({ tag: 'Type', level: 0 }), [
            { name: 'zero', type: mk.var('MyNat') },
            { name: 'succ', type: mk.arrow(mk.var('MyNat'), mk.var('MyNat')) },
        ]);
        const def: Definition = {
            tag: 'Definition',
            name: 'my_nat_ind',
            params: [],
            returnType: mk.sort({ tag: 'Type', level: 0 }),
            body: indTerm,
        };
        const result = emitLean4(makeModule([def]));
        expect(result.code).toContain('inductive MyNat');
        expect(result.code).toContain('zero');
        expect(result.code).toContain('succ');
    });

    it('generates proper imports based on axiom bundles', () => {
        const thm: Theorem = {
            ...simpleThm,
            name: 'with_axioms',
        };
        const modClassical = makeModule([thm]);
        modClassical.axiomBundle = BUNDLES.ClassicalMath;
        const resultClassical = emitLean4(modClassical);
        expect(resultClassical.code).toContain('import Mathlib.Tactic.NormNum');

        const modMinimal = makeModule([thm]);
        modMinimal.axiomBundle = BUNDLES.MinimalCore;
        const resultMinimal = emitLean4(modMinimal);
        expect(resultMinimal.code).not.toContain('import Mathlib.Tactic.NormNum');
    });

    it('emits Type without level 0 for universe', () => {
        const def: Definition = {
            tag: 'Definition',
            name: 'type_def',
            params: [],
            returnType: mk.sort({ tag: 'Type', level: 0 }),
            body: mk.hole('placeholder'),
        };
        const result = emitLean4(makeModule([def]));
        // Should use "Type" not "Type 0"
        expect(result.code).toMatch(/: Type\b/);
        expect(result.code).not.toContain('Type 0');
    });

    it('emits LetIn correctly', () => {
        const def: Definition = {
            tag: 'Definition',
            name: 'with_let',
            params: [],
            returnType: Types.Nat,
            body: mk.letIn('x', Types.Nat, mk.nat(5), mk.binOp('+', mk.var('x'), mk.nat(1))),
        };
        const result = emitLean4(makeModule([def]));
        expect(result.code).toContain('let x');
        expect(result.code).toContain(':=');
    });

    it('emits Pair as angle brackets', () => {
        const def: Definition = {
            tag: 'Definition',
            name: 'pair_def',
            params: [],
            returnType: Types.Type0,
            body: mk.pair(mk.nat(1), mk.nat(2)),
        };
        const result = emitLean4(makeModule([def]));
        expect(result.code).toContain('⟨');
        expect(result.code).toContain('⟩');
    });

    it('emits Match correctly', () => {
        const def: Definition = {
            tag: 'Definition',
            name: 'match_def',
            params: [{ name: 'n', type: Types.Nat, implicit: false }],
            returnType: Types.Nat,
            body: mk.match(mk.var('n'), [
                { pattern: 'Nat.zero', bindings: [], body: mk.nat(0) },
                { pattern: 'Nat.succ', bindings: ['m'], body: mk.var('m') },
            ]),
        };
        const result = emitLean4(makeModule([def]));
        expect(result.code).toContain('match');
        expect(result.code).toContain('=>');
        expect(result.code).toContain('Nat.zero');
        expect(result.code).toContain('Nat.succ');
    });
});

describe('Coq emitter: extended validation', () => {
    it('emits admit with Admitted. (not Qed.)', () => {
        const thm: Theorem = {
            ...simpleThm,
            name: 'admit_thm',
            proof: [{ tag: 'Sorry' }],
        };
        const result = emitCoq(makeModule([thm]));
        expect(result.code).toContain('admit');
        expect(result.code).toContain('Admitted.');
        // When there's admit, should NOT use Qed.
        const thmBlock = result.code.split('Theorem admit_thm')[1] ?? '';
        expect(thmBlock).not.toContain('Qed.');
    });

    it('emits theorem with parameters and quantifiers', () => {
        const thm: Theorem = {
            tag: 'Theorem',
            name: 'coq_forall',
            params: [
                { name: 'n', type: Types.Nat, implicit: false },
            ],
            statement: mk.forAll('x', Types.Int, mk.binOp('≥', mk.var('x'), mk.nat(0))),
            proof: [{ tag: 'Sorry' }],
            axiomBundle: BUNDLES.ClassicalMath,
            metadata: { confidence: 0.5, dependencies: [] },
        };
        const result = emitCoq(makeModule([thm]));
        expect(result.code).toContain('Theorem coq_forall');
        expect(result.code).toContain('forall');
    });

    it('emits Sigma type with sigT syntax', () => {
        const def: Definition = {
            tag: 'Definition',
            name: 'sigma_def',
            params: [],
            returnType: mk.sort({ tag: 'Type', level: 0 }),
            body: mk.sigma('x', Types.Nat, mk.binOp('>', mk.var('x'), mk.nat(0))),
        };
        const result = emitCoq(makeModule([def]));
        expect(result.code).toContain('{ x : nat & ');
    });

    it('emits Inductive with proper Coq syntax', () => {
        const indTerm = mk.ind('MyNat', mk.sort({ tag: 'Type', level: 0 }), [
            { name: 'zero', type: mk.var('MyNat') },
            { name: 'succ', type: mk.arrow(mk.var('MyNat'), mk.var('MyNat')) },
        ]);
        const def: Definition = {
            tag: 'Definition',
            name: 'ind_def',
            params: [],
            returnType: mk.sort({ tag: 'Type', level: 0 }),
            body: indTerm,
        };
        const result = emitCoq(makeModule([def]));
        expect(result.code).toContain('Inductive MyNat');
        expect(result.code).toContain('zero');
        expect(result.code).toContain('succ');
    });

    it('emits definition with lambda body', () => {
        const def: Definition = {
            tag: 'Definition',
            name: 'coq_fun',
            params: [],
            returnType: mk.arrow(Types.Nat, Types.Nat),
            body: mk.lam('x', Types.Nat, mk.binOp('+', mk.var('x'), mk.nat(1))),
        };
        const result = emitCoq(makeModule([def]));
        expect(result.code).toContain('Definition coq_fun');
        expect(result.code).toContain('fun');
    });

    it('emits modular equivalence correctly', () => {
        const thm: Theorem = {
            tag: 'Theorem',
            name: 'coq_mod',
            params: [],
            statement: mk.equiv(mk.var('a'), mk.var('b'), mk.var('p')),
            proof: [{ tag: 'Sorry' }],
            axiomBundle: BUNDLES.ClassicalMath,
            metadata: { confidence: 0.5, dependencies: [] },
        };
        const result = emitCoq(makeModule([thm]));
        expect(result.code).toContain('mod');
    });
});

describe('Isabelle emitter: extended validation', () => {
    it('emits proper theory header', () => {
        const result = emitIsabelle(makeModule([simpleThm]));
        expect(result.code).toMatch(/^.*theory\s+\w+/m);
        expect(result.code).toContain('imports Main');
        expect(result.code).toContain('begin');
        expect(result.code).toMatch(/\nend\s*$/);
    });

    it('emits theorem with parameters and sorry proof', () => {
        const thm: Theorem = {
            tag: 'Theorem',
            name: 'isa_thm',
            params: [{ name: 'n', type: Types.Nat, implicit: false }],
            statement: mk.binOp('≥', mk.var('n'), mk.nat(0)),
            proof: [{ tag: 'Sorry' }],
            axiomBundle: BUNDLES.ClassicalMath,
            metadata: { confidence: 0.5, dependencies: [] },
        };
        const result = emitIsabelle(makeModule([thm]));
        expect(result.code).toContain('theorem isa_thm');
        expect(result.code).toContain('sorry');
    });

    it('emits definition with lambda body', () => {
        const def: Definition = {
            tag: 'Definition',
            name: 'isa_fun',
            params: [],
            returnType: mk.arrow(Types.Nat, Types.Nat),
            body: mk.lam('x', Types.Nat, mk.binOp('+', mk.var('x'), mk.nat(1))),
        };
        const result = emitIsabelle(makeModule([def]));
        expect(result.code).toContain('definition isa_fun');
        expect(result.code).toContain('lambda');
    });

    it('emits modular equivalence correctly', () => {
        const thm: Theorem = {
            tag: 'Theorem',
            name: 'isa_mod',
            params: [],
            statement: mk.equiv(mk.var('a'), mk.var('b'), mk.var('p')),
            proof: [{ tag: 'Sorry' }],
            axiomBundle: BUNDLES.ClassicalMath,
            metadata: { confidence: 0.5, dependencies: [] },
        };
        const result = emitIsabelle(makeModule([thm]));
        expect(result.code).toContain('mod');
    });

    it('emits inductive type as datatype', () => {
        const indTerm = mk.ind('MyBool', mk.sort({ tag: 'Type', level: 0 }), [
            { name: 'yes', type: mk.var('MyBool') },
            { name: 'no', type: mk.var('MyBool') },
        ]);
        const def: Definition = {
            tag: 'Definition',
            name: 'isa_ind',
            params: [],
            returnType: mk.sort({ tag: 'Type', level: 0 }),
            body: indTerm,
        };
        const result = emitIsabelle(makeModule([def]));
        expect(result.code).toContain('datatype MyBool');
    });
});
