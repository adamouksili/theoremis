// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Property-Based Tests (fast-check)
// Verifies core invariants of the λΠω IR via randomized testing
// ─────────────────────────────────────────────────────────────

import { describe, it } from 'vitest';
import fc from 'fast-check';
import type { Term, BinOp as BinOpT, UnaryOp as UnaryOpT, Axiom } from '../core/ir';
import { mk, Prop, Type as TypeUni, BUNDLES, type IRModule } from '../core/ir';
import { substitute, freeVars, termsEqual } from '../core/typechecker';
import { serializeTerm } from '../api/serialize';
import { emitLean4 } from '../emitters/lean4';

// ── Arbitrary generators ─────────────────────────────────────

const arbName = fc.constantFrom('a', 'b', 'c', 'x', 'y', 'z', 'n', 'm');

const arbBinOpSym = fc.constantFrom<BinOpT['op']>(
    '+', '-', '*', '/', '^', '=', '<', '>', '≤', '≥',
    '∧', '∨', '→', '↔', 'mod', '∈', '∉', '⊆', '∪', '∩',
);

const arbUnaryOpSym = fc.constantFrom<UnaryOpT['op']>('¬', '-');

const arbAxiom = fc.constantFrom<Axiom>(
    'LEM', 'Choice', 'Univalence', 'Funext', 'Propext', 'Quotient', 'ClassicalLogic',
);

const arbLeaf: fc.Arbitrary<Term> = fc.oneof(
    arbName.map(name => mk.var(name) as Term),
    fc.nat({ max: 100 }).map(n => mk.nat(n) as Term),
    fc.integer({ min: -100, max: 100 }).map(n => mk.int(n) as Term),
    fc.boolean().map(b => mk.bool(b) as Term),
    fc.oneof(
        fc.constant(mk.sort(Prop) as Term),
        fc.nat({ max: 3 }).map(n => mk.sort(TypeUni(n)) as Term),
    ),
    fc.constantFrom('h1', 'h2', 'h3').map(id => mk.hole(id) as Term),
    arbAxiom.map(a => mk.axiomRef(a) as Term),
);

const { term: arbTerm } = fc.letrec<{ term: Term }>(tie => ({
    term: fc.oneof(
        { depthIdentifier: 'ir-term', maxDepth: 4, depthSize: 'small' },
        arbLeaf,
        fc.tuple(arbBinOpSym, tie('term'), tie('term'))
            .map(([op, l, r]) => mk.binOp(op, l, r) as Term),
        fc.tuple(arbUnaryOpSym, tie('term'))
            .map(([op, t]) => mk.unaryOp(op, t) as Term),
        fc.tuple(arbName, tie('term'), tie('term'))
            .map(([p, ty, body]) => mk.lam(p, ty, body) as Term),
        fc.tuple(tie('term'), tie('term'))
            .map(([f, a]) => mk.app(f, a) as Term),
        fc.tuple(arbName, tie('term'), tie('term'))
            .map(([p, ty, body]) => mk.pi(p, ty, body) as Term),
        fc.tuple(arbName, tie('term'), tie('term'))
            .map(([p, dom, body]) => mk.forAll(p, dom, body) as Term),
        fc.tuple(arbName, tie('term'), tie('term'))
            .map(([p, dom, body]) => mk.exists(p, dom, body) as Term),
        fc.tuple(tie('term'), tie('term'))
            .map(([fst, snd]) => mk.pair(fst, snd) as Term),
        fc.tuple(tie('term'), fc.constantFrom<1 | 2>(1, 2))
            .map(([t, i]) => mk.proj(t, i) as Term),
        fc.tuple(arbName, tie('term'), tie('term'), tie('term'))
            .map(([name, ty, val, body]) => mk.letIn(name, ty, val, body) as Term),
        fc.tuple(tie('term'), tie('term'))
            .map(([l, r]) => mk.equiv(l, r) as Term),
        fc.tuple(tie('term'), tie('term'), tie('term'))
            .map(([l, r, m]) => mk.equiv(l, r, m) as Term),
    ),
}));

// ── Helpers ──────────────────────────────────────────────────

function setUnion(a: Set<string>, b: Set<string>): Set<string> {
    const r = new Set(a);
    for (const v of b) r.add(v);
    return r;
}

function isSubsetOf(a: Set<string>, b: Set<string>): boolean {
    for (const v of a) {
        if (!b.has(v)) return false;
    }
    return true;
}

// ── 1. Substitution properties ───────────────────────────────

describe('Substitution properties', () => {
    it('identity substitution: fresh variable has no effect', () => {
        fc.assert(
            fc.property(arbTerm, arbTerm, (t, replacement) => {
                const result = substitute(t, 'FRESH__never_used', replacement);
                return termsEqual(result, t);
            }),
            { numRuns: 200 },
        );
    });

    it('free variable removal: substituted var disappears unless replacement reintroduces it', () => {
        fc.assert(
            fc.property(arbTerm, arbName, arbTerm, (t, x, r) => {
                const result = substitute(t, x, r);
                const resultFV = freeVars(result);
                if (!freeVars(r).has(x)) {
                    return !resultFV.has(x);
                }
                return true;
            }),
            { numRuns: 200 },
        );
    });

    it('idempotence of self-substitution: substitute(t, x, Var(x)) ≡ t', () => {
        fc.assert(
            fc.property(arbTerm, arbName, (t, x) => {
                return termsEqual(substitute(t, x, mk.var(x)), t);
            }),
            { numRuns: 200 },
        );
    });
});

// ── 2. Free variable properties ──────────────────────────────

describe('Free variable properties', () => {
    it('bound variable is excluded from freeVars of lambda', () => {
        fc.assert(
            fc.property(arbName, arbTerm, (p, body) => {
                const lam = mk.lam(p, mk.sort(Prop), body);
                return !freeVars(lam).has(p);
            }),
            { numRuns: 200 },
        );
    });

    it('freeVars(App(f, a)) ⊆ freeVars(f) ∪ freeVars(a)', () => {
        fc.assert(
            fc.property(arbTerm, arbTerm, (f, a) => {
                const appFV = freeVars(mk.app(f, a));
                const combined = setUnion(freeVars(f), freeVars(a));
                return isSubsetOf(appFV, combined);
            }),
            { numRuns: 200 },
        );
    });

    it('literals have no free variables', () => {
        fc.assert(
            fc.property(fc.nat({ max: 10000 }), (n) => {
                return freeVars(mk.nat(n)).size === 0;
            }),
            { numRuns: 200 },
        );
    });
});

// ── 3. termsEqual properties ─────────────────────────────────

describe('termsEqual properties', () => {
    it('reflexivity: termsEqual(t, t) is always true', () => {
        fc.assert(
            fc.property(arbTerm, (t) => {
                return termsEqual(t, t);
            }),
            { numRuns: 200 },
        );
    });

    it('symmetry: termsEqual(a, b) === termsEqual(b, a)', () => {
        fc.assert(
            fc.property(arbTerm, arbTerm, (a, b) => {
                return termsEqual(a, b) === termsEqual(b, a);
            }),
            { numRuns: 200 },
        );
    });
});

// ── 4. Serialization roundtrip ───────────────────────────────

describe('Serialization roundtrip', () => {
    it('structure preservation: serialized tag matches term tag', () => {
        fc.assert(
            fc.property(arbTerm, (t) => {
                const serialized = serializeTerm(t);
                return serialized.tag === t.tag;
            }),
            { numRuns: 200 },
        );
    });

    it('determinism: serializing twice yields deep-equal results', () => {
        fc.assert(
            fc.property(arbTerm, (t) => {
                const a = JSON.stringify(serializeTerm(t));
                const b = JSON.stringify(serializeTerm(t));
                return a === b;
            }),
            { numRuns: 200 },
        );
    });
});

// ── 5. Emitter totality ─────────────────────────────────────

describe('Emitter totality', () => {
    it('emitLean4 does not throw for any well-formed term', () => {
        fc.assert(
            fc.property(arbTerm, (t) => {
                const mod: IRModule = {
                    name: 'PropertyTest',
                    declarations: [{
                        tag: 'Definition',
                        name: 'prop_test',
                        params: [],
                        returnType: mk.sort(Prop),
                        body: t,
                    }],
                    axiomBundle: BUNDLES.ClassicalMath!,
                    imports: [],
                };
                const result = emitLean4(mod);
                return typeof result.code === 'string' && result.code.length > 0;
            }),
            { numRuns: 150 },
        );
    });
});
