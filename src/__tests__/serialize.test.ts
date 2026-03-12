// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Serialization Tests
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    serializeTerm,
    serializeDeclaration,
    serializeModule,
    serializeDocument,
    serializeTypeCheck,
    serializeTestReport,
} from '../api/serialize';
import { mk, Types, BUNDLES, Prop, Type } from '../core/ir';
import type { IRModule, Theorem, Lemma, Definition, Tactic } from '../core/ir';
import type { MathDocument } from '../parser/ast';
import type { TypeCheckResult } from '../core/typechecker';
import type { RandomTestReport } from '../engine/evaluator';

// ── serializeTerm ───────────────────────────────────────────

describe('serializeTerm', () => {
    it('Var', () => {
        expect(serializeTerm(mk.var('x'))).toEqual({ tag: 'Var', name: 'x' });
    });

    it('Literal (Nat)', () => {
        expect(serializeTerm(mk.nat(42))).toEqual({ tag: 'Literal', kind: 'Nat', value: '42' });
    });

    it('Literal (Int)', () => {
        expect(serializeTerm(mk.int(-7))).toEqual({ tag: 'Literal', kind: 'Int', value: '-7' });
    });

    it('Literal (Bool)', () => {
        expect(serializeTerm(mk.bool(true))).toEqual({ tag: 'Literal', kind: 'Bool', value: 'true' });
    });

    it('Lam', () => {
        const t = mk.lam('x', Types.Nat, mk.var('x'));
        expect(serializeTerm(t)).toEqual({
            tag: 'Lam',
            param: 'x',
            paramType: { tag: 'Var', name: 'ℕ' },
            body: { tag: 'Var', name: 'x' },
        });
    });

    it('App', () => {
        const t = mk.app(mk.var('f'), mk.nat(1));
        expect(serializeTerm(t)).toEqual({
            tag: 'App',
            func: { tag: 'Var', name: 'f' },
            arg: { tag: 'Literal', kind: 'Nat', value: '1' },
        });
    });

    it('Pi', () => {
        const t = mk.pi('n', Types.Nat, Types.Prop);
        expect(serializeTerm(t)).toEqual({
            tag: 'Pi',
            param: 'n',
            paramType: { tag: 'Var', name: 'ℕ' },
            body: { tag: 'Sort', universe: { tag: 'Prop' } },
        });
    });

    it('Pi (arrow shorthand)', () => {
        const t = mk.arrow(Types.Nat, Types.Bool);
        expect(serializeTerm(t)).toEqual({
            tag: 'Pi',
            param: '_',
            paramType: { tag: 'Var', name: 'ℕ' },
            body: { tag: 'Var', name: 'Bool' },
        });
    });

    it('Sigma', () => {
        const t = mk.sigma('x', Types.Nat, mk.binOp('>', mk.var('x'), mk.nat(0)));
        const s = serializeTerm(t);
        expect(s).toHaveProperty('tag', 'Sigma');
        expect(s).toHaveProperty('param', 'x');
        expect(s).toHaveProperty('paramType.tag', 'Var');
        expect(s).toHaveProperty('body.tag', 'BinOp');
    });

    it('Pair', () => {
        const t = mk.pair(mk.nat(1), mk.bool(false));
        expect(serializeTerm(t)).toEqual({
            tag: 'Pair',
            fst: { tag: 'Literal', kind: 'Nat', value: '1' },
            snd: { tag: 'Literal', kind: 'Bool', value: 'false' },
        });
    });

    it('Proj', () => {
        const t = mk.proj(mk.pair(mk.nat(1), mk.nat(2)), 1);
        const s = serializeTerm(t);
        expect(s).toHaveProperty('tag', 'Proj');
        expect(s).toHaveProperty('index', 1);
        expect(s).toHaveProperty('term.tag', 'Pair');
    });

    it('LetIn', () => {
        const t = mk.letIn('x', Types.Nat, mk.nat(5), mk.var('x'));
        expect(serializeTerm(t)).toEqual({
            tag: 'LetIn',
            name: 'x',
            type: { tag: 'Var', name: 'ℕ' },
            value: { tag: 'Literal', kind: 'Nat', value: '5' },
            body: { tag: 'Var', name: 'x' },
        });
    });

    it('Sort (Prop)', () => {
        expect(serializeTerm(mk.sort(Prop))).toEqual({ tag: 'Sort', universe: { tag: 'Prop' } });
    });

    it('Sort (Type 1)', () => {
        expect(serializeTerm(mk.sort(Type(1)))).toEqual({ tag: 'Sort', universe: { tag: 'Type', level: 1 } });
    });

    it('Ind', () => {
        const t = mk.ind('Bool', mk.sort(Type(0)), [
            { name: 'true', type: mk.var('Bool') },
            { name: 'false', type: mk.var('Bool') },
        ]);
        const s = serializeTerm(t);
        expect(s).toEqual({
            tag: 'Ind',
            name: 'Bool',
            type: { tag: 'Sort', universe: { tag: 'Type', level: 0 } },
            constructors: [
                { name: 'true', type: { tag: 'Var', name: 'Bool' } },
                { name: 'false', type: { tag: 'Var', name: 'Bool' } },
            ],
        });
    });

    it('Match', () => {
        const t = mk.match(mk.var('b'), [
            { pattern: 'true', bindings: [], body: mk.nat(1) },
            { pattern: 'false', bindings: [], body: mk.nat(0) },
        ]);
        const s = serializeTerm(t);
        expect(s).toHaveProperty('tag', 'Match');
        expect(s).toHaveProperty('scrutinee.tag', 'Var');
        expect((s as any).cases).toHaveLength(2);
        expect((s as any).cases[0]).toEqual({
            pattern: 'true',
            bindings: [],
            body: { tag: 'Literal', kind: 'Nat', value: '1' },
        });
    });

    it('Hole (with context)', () => {
        expect(serializeTerm(mk.hole('?h1', 'goal context'))).toEqual({
            tag: 'Hole',
            id: '?h1',
            context: 'goal context',
        });
    });

    it('Hole (without context)', () => {
        expect(serializeTerm(mk.hole('?h2'))).toEqual({
            tag: 'Hole',
            id: '?h2',
            context: undefined,
        });
    });

    it('AxiomRef', () => {
        expect(serializeTerm(mk.axiomRef('LEM'))).toEqual({ tag: 'AxiomRef', axiom: 'LEM' });
    });

    it('BinOp', () => {
        const t = mk.binOp('+', mk.var('a'), mk.nat(3));
        expect(serializeTerm(t)).toEqual({
            tag: 'BinOp',
            op: '+',
            left: { tag: 'Var', name: 'a' },
            right: { tag: 'Literal', kind: 'Nat', value: '3' },
        });
    });

    it('UnaryOp', () => {
        const t = mk.unaryOp('¬', mk.var('p'));
        expect(serializeTerm(t)).toEqual({
            tag: 'UnaryOp',
            op: '¬',
            operand: { tag: 'Var', name: 'p' },
        });
    });

    it('Equiv (without modulus)', () => {
        const t = mk.equiv(mk.var('a'), mk.var('b'));
        expect(serializeTerm(t)).toEqual({
            tag: 'Equiv',
            left: { tag: 'Var', name: 'a' },
            right: { tag: 'Var', name: 'b' },
            modulus: null,
        });
    });

    it('Equiv (with modulus)', () => {
        const t = mk.equiv(mk.nat(7), mk.nat(2), mk.nat(5));
        expect(serializeTerm(t)).toEqual({
            tag: 'Equiv',
            left: { tag: 'Literal', kind: 'Nat', value: '7' },
            right: { tag: 'Literal', kind: 'Nat', value: '2' },
            modulus: { tag: 'Literal', kind: 'Nat', value: '5' },
        });
    });

    it('ForAll', () => {
        const t = mk.forAll('n', Types.Nat, mk.binOp('≥', mk.var('n'), mk.nat(0)));
        const s = serializeTerm(t);
        expect(s).toEqual({
            tag: 'ForAll',
            param: 'n',
            domain: { tag: 'Var', name: 'ℕ' },
            body: {
                tag: 'BinOp',
                op: '≥',
                left: { tag: 'Var', name: 'n' },
                right: { tag: 'Literal', kind: 'Nat', value: '0' },
            },
        });
    });

    it('Exists', () => {
        const t = mk.exists('x', Types.Real, mk.binOp('=', mk.binOp('*', mk.var('x'), mk.var('x')), mk.nat(2)));
        const s = serializeTerm(t);
        expect(s).toHaveProperty('tag', 'Exists');
        expect(s).toHaveProperty('param', 'x');
        expect(s).toHaveProperty('domain.name', 'ℝ');
        expect(s).toHaveProperty('body.tag', 'BinOp');
    });

    it('recursively serializes nested terms', () => {
        const nested = mk.lam('f', mk.arrow(Types.Nat, Types.Nat), mk.app(mk.var('f'), mk.app(mk.var('f'), mk.nat(0))));
        const s = serializeTerm(nested);
        expect(s).toHaveProperty('tag', 'Lam');
        expect(s).toHaveProperty('body.tag', 'App');
        expect(s).toHaveProperty('body.arg.tag', 'App');
        expect(s).toHaveProperty('body.arg.arg.tag', 'Literal');
    });
});

// ── serializeDeclaration ────────────────────────────────────

describe('serializeDeclaration', () => {
    it('Definition', () => {
        const def: Definition = {
            tag: 'Definition',
            name: 'double',
            params: [{ name: 'n', type: Types.Nat, implicit: false }],
            returnType: Types.Nat,
            body: mk.binOp('*', mk.nat(2), mk.var('n')),
        };
        const s = serializeDeclaration(def);
        expect(s).toHaveProperty('tag', 'Definition');
        expect(s).toHaveProperty('name', 'double');
        expect(s).toHaveProperty('params');
        expect((s.params as any[])).toHaveLength(1);
        expect((s.params as any[])[0]).toEqual({
            name: 'n',
            type: { tag: 'Var', name: 'ℕ' },
            implicit: false,
        });
        expect(s).toHaveProperty('returnType.tag', 'Var');
        expect(s).toHaveProperty('body.tag', 'BinOp');
    });

    it('Definition with implicit param', () => {
        const def: Definition = {
            tag: 'Definition',
            name: 'id',
            params: [
                { name: 'α', type: mk.sort(Type(0)), implicit: true },
                { name: 'x', type: mk.var('α'), implicit: false },
            ],
            returnType: mk.var('α'),
            body: mk.var('x'),
        };
        const s = serializeDeclaration(def);
        expect((s.params as any[])[0].implicit).toBe(true);
        expect((s.params as any[])[1].implicit).toBe(false);
    });

    it('Theorem (with tactics and metadata)', () => {
        const thm: Theorem = {
            tag: 'Theorem',
            name: 'nat_nonneg',
            params: [{ name: 'n', type: Types.Nat, implicit: false }],
            statement: mk.binOp('≥', mk.var('n'), mk.nat(0)),
            proof: [
                { tag: 'Intro', names: ['n'] },
                { tag: 'Omega' },
            ],
            axiomBundle: BUNDLES.ClassicalMath!,
            metadata: { confidence: 0.95, dependencies: ['Nat.zero_le'], source: 'mathlib' },
        };
        const s = serializeDeclaration(thm);
        expect(s).toHaveProperty('tag', 'Theorem');
        expect(s).toHaveProperty('name', 'nat_nonneg');
        expect(s).toHaveProperty('statement.tag', 'BinOp');
        expect((s.proof as any[])).toHaveLength(2);
        expect((s.proof as any[])[0]).toEqual({ tag: 'Intro', names: ['n'] });
        expect((s.proof as any[])[1]).toEqual({ tag: 'Omega' });
        expect(s).toHaveProperty('axioms');
        expect((s.axioms as string[])).toContain('LEM');
        expect(s).toHaveProperty('metadata.confidence', 0.95);
        expect(s).toHaveProperty('metadata.source', 'mathlib');
    });

    it('Lemma', () => {
        const lem: Lemma = {
            tag: 'Lemma',
            name: 'add_comm_helper',
            params: [],
            statement: mk.forAll('a', Types.Nat,
                mk.forAll('b', Types.Nat,
                    mk.binOp('=', mk.binOp('+', mk.var('a'), mk.var('b')), mk.binOp('+', mk.var('b'), mk.var('a'))))),
            proof: [{ tag: 'Sorry' }],
        };
        const s = serializeDeclaration(lem);
        expect(s).toHaveProperty('tag', 'Lemma');
        expect(s).toHaveProperty('name', 'add_comm_helper');
        expect((s.params as any[])).toHaveLength(0);
        expect(s).toHaveProperty('statement.tag', 'ForAll');
        expect((s.proof as any[])).toEqual([{ tag: 'Sorry' }]);
    });
});

// ── serializeTactic (tested via serializeDeclaration) ───────

describe('serializeTactic (via Theorem/Lemma)', () => {
    function serializeTactics(tactics: Tactic[]): unknown[] {
        const thm: Theorem = {
            tag: 'Theorem',
            name: '_t',
            params: [],
            statement: mk.var('P'),
            proof: tactics,
            axiomBundle: BUNDLES.MinimalCore!,
            metadata: { confidence: 1, dependencies: [] },
        };
        return serializeDeclaration(thm).proof as unknown[];
    }

    it('Intro', () => {
        expect(serializeTactics([{ tag: 'Intro', names: ['x', 'y'] }])).toEqual([
            { tag: 'Intro', names: ['x', 'y'] },
        ]);
    });

    it('Apply', () => {
        expect(serializeTactics([{ tag: 'Apply', term: mk.var('h') }])).toEqual([
            { tag: 'Apply', term: { tag: 'Var', name: 'h' } },
        ]);
    });

    it('Rewrite', () => {
        expect(serializeTactics([{ tag: 'Rewrite', term: mk.var('eq1'), direction: 'ltr' }])).toEqual([
            { tag: 'Rewrite', term: { tag: 'Var', name: 'eq1' }, direction: 'ltr' },
        ]);
    });

    it('Induction', () => {
        expect(serializeTactics([{ tag: 'Induction', name: 'n' }])).toEqual([
            { tag: 'Induction', name: 'n' },
        ]);
    });

    it('Cases', () => {
        expect(serializeTactics([{ tag: 'Cases', term: mk.var('b') }])).toEqual([
            { tag: 'Cases', term: { tag: 'Var', name: 'b' } },
        ]);
    });

    it('Simp', () => {
        expect(serializeTactics([{ tag: 'Simp', lemmas: ['Nat.add_zero', 'Nat.zero_add'] }])).toEqual([
            { tag: 'Simp', lemmas: ['Nat.add_zero', 'Nat.zero_add'] },
        ]);
    });

    it('Omega', () => {
        expect(serializeTactics([{ tag: 'Omega' }])).toEqual([{ tag: 'Omega' }]);
    });

    it('Sorry', () => {
        expect(serializeTactics([{ tag: 'Sorry' }])).toEqual([{ tag: 'Sorry' }]);
    });

    it('Auto', () => {
        expect(serializeTactics([{ tag: 'Auto', depth: 5 }])).toEqual([{ tag: 'Auto', depth: 5 }]);
    });

    it('Exact', () => {
        expect(serializeTactics([{ tag: 'Exact', term: mk.nat(0) }])).toEqual([
            { tag: 'Exact', term: { tag: 'Literal', kind: 'Nat', value: '0' } },
        ]);
    });

    it('Ring', () => {
        expect(serializeTactics([{ tag: 'Ring' }])).toEqual([{ tag: 'Ring' }]);
    });

    it('LLMSuggest', () => {
        expect(serializeTactics([{ tag: 'LLMSuggest', context: 'prove P → Q' }])).toEqual([
            { tag: 'LLMSuggest', context: 'prove P → Q' },
        ]);
    });

    it('Seq (nested)', () => {
        const seq: Tactic = {
            tag: 'Seq',
            tactics: [
                { tag: 'Intro', names: ['h'] },
                { tag: 'Apply', term: mk.var('h') },
            ],
        };
        const [s] = serializeTactics([seq]);
        expect(s).toEqual({
            tag: 'Seq',
            tactics: [
                { tag: 'Intro', names: ['h'] },
                { tag: 'Apply', term: { tag: 'Var', name: 'h' } },
            ],
        });
    });

    it('Alt (nested)', () => {
        const alt: Tactic = {
            tag: 'Alt',
            tactics: [
                { tag: 'Omega' },
                { tag: 'Ring' },
                { tag: 'Sorry' },
            ],
        };
        const [s] = serializeTactics([alt]);
        expect(s).toEqual({
            tag: 'Alt',
            tactics: [
                { tag: 'Omega' },
                { tag: 'Ring' },
                { tag: 'Sorry' },
            ],
        });
    });

    it('deeply nested Seq/Alt', () => {
        const deep: Tactic = {
            tag: 'Seq',
            tactics: [
                { tag: 'Intro', names: ['n'] },
                {
                    tag: 'Alt',
                    tactics: [
                        { tag: 'Omega' },
                        { tag: 'Seq', tactics: [{ tag: 'Simp', lemmas: [] }, { tag: 'Ring' }] },
                    ],
                },
            ],
        };
        const [s] = serializeTactics([deep]) as any[];
        expect(s.tag).toBe('Seq');
        expect(s.tactics[1].tag).toBe('Alt');
        expect(s.tactics[1].tactics[1].tag).toBe('Seq');
        expect(s.tactics[1].tactics[1].tactics).toHaveLength(2);
    });
});

// ── serializeModule ─────────────────────────────────────────

describe('serializeModule', () => {
    it('round-trips a simple module', () => {
        const def: Definition = {
            tag: 'Definition',
            name: 'sq',
            params: [{ name: 'n', type: Types.Nat, implicit: false }],
            returnType: Types.Nat,
            body: mk.binOp('*', mk.var('n'), mk.var('n')),
        };
        const thm: Theorem = {
            tag: 'Theorem',
            name: 'sq_nonneg',
            params: [{ name: 'n', type: Types.Nat, implicit: false }],
            statement: mk.binOp('≥', mk.app(mk.var('sq'), mk.var('n')), mk.nat(0)),
            proof: [{ tag: 'Omega' }],
            axiomBundle: BUNDLES.ClassicalMath!,
            metadata: { confidence: 1, dependencies: ['sq'] },
        };
        const mod: IRModule = {
            name: 'Arithmetic',
            declarations: [def, thm],
            axiomBundle: BUNDLES.ClassicalMath!,
            imports: ['Mathlib.Tactic'],
        };
        const s = serializeModule(mod);

        expect(s.name).toBe('Arithmetic');
        expect((s.declarations as any[])).toHaveLength(2);
        expect((s.declarations as any[])[0].tag).toBe('Definition');
        expect((s.declarations as any[])[1].tag).toBe('Theorem');
        expect(s.imports).toEqual(['Mathlib.Tactic']);
        expect((s.axiomBundle as any).name).toBe('ClassicalMath');
        expect((s.axiomBundle as any).axioms).toContain('LEM');
        expect(typeof (s.axiomBundle as any).description).toBe('string');
    });

    it('serializes axiomBundle.axioms as an array (not Set)', () => {
        const mod: IRModule = {
            name: 'Empty',
            declarations: [],
            axiomBundle: BUNDLES.MinimalCore!,
            imports: [],
        };
        const s = serializeModule(mod);
        expect(Array.isArray((s.axiomBundle as any).axioms)).toBe(true);
        expect((s.axiomBundle as any).axioms).toHaveLength(0);
    });

    it('preserves import order', () => {
        const mod: IRModule = {
            name: 'M',
            declarations: [],
            axiomBundle: BUNDLES.MinimalCore!,
            imports: ['A', 'B', 'C'],
        };
        expect(serializeModule(mod).imports).toEqual(['A', 'B', 'C']);
    });
});

// ── serializeDocument ───────────────────────────────────────

describe('serializeDocument', () => {
    it('serializes an empty document', () => {
        const doc: MathDocument = {
            title: 'Empty',
            nodes: [],
            dependencies: [],
            rawSource: '',
            parseErrors: [],
        };
        const s = serializeDocument(doc);
        expect(s).toEqual({ title: 'Empty', nodes: [], dependencies: [], parseErrors: [] });
    });

    it('serializes ThmNode', () => {
        const doc: MathDocument = {
            title: 'T',
            nodes: [{
                tag: 'ThmNode',
                name: 'thm1',
                label: 'Theorem 1',
                hypotheses: [{
                    name: 'h',
                    condition: mk.binOp('>', mk.var('n'), mk.nat(0)),
                    description: 'n is positive',
                }],
                conclusion: mk.binOp('≥', mk.var('n'), mk.nat(1)),
                proof: { tag: 'ProofNode', tactics: [{ tag: 'Omega' }], rawLatex: '', strategy: 'omega', line: 5 },
                rawLatex: '',
                line: 1,
            }],
            dependencies: [],
            rawSource: '',
        };
        const s = serializeDocument(doc);
        const node = (s.nodes as any[])[0];
        expect(node.tag).toBe('ThmNode');
        expect(node.name).toBe('thm1');
        expect(node.label).toBe('Theorem 1');
        expect(node.hypotheses).toHaveLength(1);
        expect(node.hypotheses[0].name).toBe('h');
        expect(node.hypotheses[0].condition.tag).toBe('BinOp');
        expect(node.hypotheses[0].description).toBe('n is positive');
        expect(node.conclusion.tag).toBe('BinOp');
        expect(node.hasProof).toBe(true);
        expect(node.proofStrategy).toBe('omega');
        expect(node.line).toBe(1);
    });

    it('ThmNode without proof', () => {
        const doc: MathDocument = {
            title: 'T',
            nodes: [{
                tag: 'ThmNode',
                name: 'open_conj',
                label: 'Open Conjecture',
                hypotheses: [],
                conclusion: mk.var('P'),
                proof: null,
                rawLatex: '',
                line: 10,
            }],
            dependencies: [],
            rawSource: '',
        };
        const node = (serializeDocument(doc).nodes as any[])[0];
        expect(node.hasProof).toBe(false);
        expect(node.proofStrategy).toBeNull();
    });

    it('serializes LemmaNode', () => {
        const doc: MathDocument = {
            title: 'L',
            nodes: [{
                tag: 'LemmaNode',
                name: 'lem1',
                label: 'Helper lemma',
                hypotheses: [],
                conclusion: mk.var('Q'),
                proof: null,
                rawLatex: '',
                line: 3,
            }],
            dependencies: [],
            rawSource: '',
        };
        const node = (serializeDocument(doc).nodes as any[])[0];
        expect(node.tag).toBe('LemmaNode');
        expect(node.hasProof).toBe(false);
    });

    it('serializes DefNode', () => {
        const doc: MathDocument = {
            title: 'D',
            nodes: [{
                tag: 'DefNode',
                name: 'succ',
                params: [{ name: 'n', type: Types.Nat, description: 'a natural number' }],
                body: mk.binOp('+', mk.var('n'), mk.nat(1)),
                rawLatex: '',
                line: 2,
            }],
            dependencies: [],
            rawSource: '',
        };
        const node = (serializeDocument(doc).nodes as any[])[0];
        expect(node.tag).toBe('DefNode');
        expect(node.name).toBe('succ');
        expect(node.params).toHaveLength(1);
        expect(node.params[0].description).toBe('a natural number');
        expect(node.body).not.toBeNull();
        expect(node.body.tag).toBe('BinOp');
    });

    it('DefNode with null body', () => {
        const doc: MathDocument = {
            title: 'D',
            nodes: [{
                tag: 'DefNode',
                name: 'abstract_thing',
                params: [],
                body: null,
                rawLatex: '',
                line: 1,
            }],
            dependencies: [],
            rawSource: '',
        };
        const node = (serializeDocument(doc).nodes as any[])[0];
        expect(node.body).toBeNull();
    });

    it('serializes ProofNode', () => {
        const doc: MathDocument = {
            title: 'P',
            nodes: [{
                tag: 'ProofNode',
                tactics: [{ tag: 'Intro', names: ['h'] }, { tag: 'Apply', term: mk.var('h') }],
                rawLatex: '',
                strategy: 'direct',
                line: 7,
            }],
            dependencies: [],
            rawSource: '',
        };
        const node = (serializeDocument(doc).nodes as any[])[0];
        expect(node.tag).toBe('ProofNode');
        expect(node.strategy).toBe('direct');
        expect(node.tacticsCount).toBe(2);
        expect(node.line).toBe(7);
    });

    it('serializes RemarkNode and ExampleNode', () => {
        const doc: MathDocument = {
            title: 'R',
            nodes: [
                { tag: 'RemarkNode', content: 'This follows from the axiom of choice.', line: 1 },
                { tag: 'ExampleNode', content: 'Consider n = 5.', line: 2 },
            ],
            dependencies: [],
            rawSource: '',
        };
        const nodes = serializeDocument(doc).nodes as any[];
        expect(nodes[0]).toEqual({ tag: 'RemarkNode', content: 'This follows from the axiom of choice.', line: 1 });
        expect(nodes[1]).toEqual({ tag: 'ExampleNode', content: 'Consider n = 5.', line: 2 });
    });

    it('serializes SectionNode with children', () => {
        const doc: MathDocument = {
            title: 'S',
            nodes: [{
                tag: 'SectionNode',
                title: 'Preliminaries',
                children: [
                    { tag: 'RemarkNode', content: 'We recall...', line: 3 },
                    { tag: 'RefNode', target: 'thm1', kind: 'theorem' as const, line: 4 },
                ],
                line: 2,
            }],
            dependencies: [],
            rawSource: '',
        };
        const node = (serializeDocument(doc).nodes as any[])[0];
        expect(node.tag).toBe('SectionNode');
        expect(node.title).toBe('Preliminaries');
        expect(node.children).toHaveLength(2);
        expect(node.children[0].tag).toBe('RemarkNode');
        expect(node.children[1].tag).toBe('RefNode');
    });

    it('serializes RefNode', () => {
        const doc: MathDocument = {
            title: 'R',
            nodes: [{ tag: 'RefNode', target: 'def_prime', kind: 'definition' as const, line: 9 }],
            dependencies: [],
            rawSource: '',
        };
        const node = (serializeDocument(doc).nodes as any[])[0];
        expect(node).toEqual({ tag: 'RefNode', target: 'def_prime', kind: 'definition', line: 9 });
    });

    it('includes dependencies and parseErrors', () => {
        const doc: MathDocument = {
            title: 'D',
            nodes: [],
            dependencies: [
                { from: 'thm2', to: 'lem1', kind: 'uses' },
                { from: 'thm3', to: 'thm2', kind: 'extends' },
            ],
            rawSource: '',
            parseErrors: [{ message: 'unexpected token', line: 5, column: 12 }],
        };
        const s = serializeDocument(doc);
        expect(s.dependencies).toEqual([
            { from: 'thm2', to: 'lem1', kind: 'uses' },
            { from: 'thm3', to: 'thm2', kind: 'extends' },
        ]);
        expect(s.parseErrors).toEqual([{ message: 'unexpected token', line: 5, column: 12 }]);
    });

    it('defaults parseErrors to [] when undefined', () => {
        const doc: MathDocument = {
            title: 'D',
            nodes: [],
            dependencies: [],
            rawSource: '',
        };
        expect(serializeDocument(doc).parseErrors).toEqual([]);
    });
});

// ── serializeTypeCheck ──────────────────────────────────────

describe('serializeTypeCheck', () => {
    it('serializes a valid result', () => {
        const tc: TypeCheckResult = {
            valid: true,
            mode: 'permissive',
            diagnostics: [],
            inferredTypes: new Map(),
            holes: [],
            axiomUsage: new Set(),
        };
        const s = serializeTypeCheck(tc);
        expect(s.valid).toBe(true);
        expect(s.mode).toBe('permissive');
        expect(s.diagnostics).toEqual([]);
        expect(s.holes).toEqual([]);
        expect(s.axiomUsage).toEqual([]);
        expect(s.inferredTypes).toEqual({});
        expect(s.strictDiagnostics).toBeNull();
    });

    it('serializes diagnostics', () => {
        const tc: TypeCheckResult = {
            valid: false,
            mode: 'strict',
            diagnostics: [
                { severity: 'error', message: 'type mismatch', location: 'line 5' },
                { severity: 'warning', message: 'unused variable' },
            ],
            inferredTypes: new Map(),
            holes: [],
            axiomUsage: new Set(),
        };
        const s = serializeTypeCheck(tc);
        expect((s.diagnostics as any[])).toHaveLength(2);
        expect((s.diagnostics as any[])[0]).toEqual({ severity: 'error', message: 'type mismatch', location: 'line 5' });
        expect((s.diagnostics as any[])[1]).toEqual({ severity: 'warning', message: 'unused variable', location: null });
    });

    it('serializes holes', () => {
        const tc: TypeCheckResult = {
            valid: true,
            mode: 'permissive',
            diagnostics: [],
            inferredTypes: new Map(),
            holes: [
                { id: '?h1', context: new Map([['x', Types.Nat]]), suggestions: ['exact 0', 'omega'] },
                { id: '?h2', context: new Map(), suggestions: [] },
            ],
            axiomUsage: new Set(),
        };
        const s = serializeTypeCheck(tc);
        expect((s.holes as any[])).toHaveLength(2);
        expect((s.holes as any[])[0]).toEqual({ id: '?h1', suggestions: ['exact 0', 'omega'] });
        expect((s.holes as any[])[1]).toEqual({ id: '?h2', suggestions: [] });
    });

    it('serializes axiomUsage as array', () => {
        const tc: TypeCheckResult = {
            valid: true,
            mode: 'permissive',
            diagnostics: [],
            inferredTypes: new Map(),
            holes: [],
            axiomUsage: new Set(['LEM', 'Choice']),
        };
        const s = serializeTypeCheck(tc);
        expect(Array.isArray(s.axiomUsage)).toBe(true);
        expect(s.axiomUsage).toContain('LEM');
        expect(s.axiomUsage).toContain('Choice');
    });

    it('serializes inferredTypes map to object', () => {
        const tc: TypeCheckResult = {
            valid: true,
            mode: 'permissive',
            diagnostics: [],
            inferredTypes: new Map<string, import('../core/ir').Term>([
                ['x', Types.Nat],
                ['f', mk.arrow(Types.Nat, Types.Nat)],
            ]),
            holes: [],
            axiomUsage: new Set(),
        };
        const s = serializeTypeCheck(tc);
        const inferred = s.inferredTypes as Record<string, any>;
        expect(inferred['x']).toEqual({ tag: 'Var', name: 'ℕ' });
        expect(inferred['f']).toHaveProperty('tag', 'Pi');
    });

    it('serializes strictDiagnostics when present', () => {
        const tc: TypeCheckResult = {
            valid: false,
            mode: 'strict',
            diagnostics: [],
            inferredTypes: new Map(),
            holes: [],
            axiomUsage: new Set(),
            strictDiagnostics: { fallbackErrors: 2, unresolvedTermErrors: 1, universeErrors: 0 },
        };
        const s = serializeTypeCheck(tc);
        expect(s.strictDiagnostics).toEqual({ fallbackErrors: 2, unresolvedTermErrors: 1, universeErrors: 0 });
    });
});

// ── serializeTestReport ─────────────────────────────────────

describe('serializeTestReport', () => {
    it('serializes basic fields', () => {
        const report: RandomTestReport = {
            totalTests: 100,
            passed: 98,
            failed: 2,
            skipped: 0,
            preconditionSkipped: 0,
            classification: 'likely_true',
            time: 1.23456,
            counterexamples: [
                { passed: false, witness: { n: -1 }, evaluated: false },
                { passed: false, witness: { n: -2 }, evaluated: false },
            ],
        };
        const s = serializeTestReport(report);
        expect(s.totalTests).toBe(100);
        expect(s.passed).toBe(98);
        expect(s.failed).toBe(2);
        expect(s.skipped).toBe(0);
        expect(s.preconditionSkipped).toBe(0);
        expect(s.classification).toBe('likely_true');
    });

    it('rounds time to 2 decimal places', () => {
        const report: RandomTestReport = {
            totalTests: 1,
            passed: 1,
            failed: 0,
            skipped: 0,
            preconditionSkipped: 0,
            classification: 'verified',
            time: 0.12789,
            counterexamples: [],
        };
        expect(serializeTestReport(report).time).toBe(0.13);
    });

    it('truncates counterexamples to 5', () => {
        const ces = Array.from({ length: 10 }, (_, i) => ({
            passed: false,
            witness: { x: i } as Record<string, any>,
            evaluated: null as any,
        }));
        const report: RandomTestReport = {
            totalTests: 10,
            passed: 0,
            failed: 10,
            skipped: 0,
            preconditionSkipped: 0,
            classification: 'falsified',
            time: 0.5,
            counterexamples: ces,
        };
        const s = serializeTestReport(report);
        expect((s.counterexamples as any[])).toHaveLength(5);
        expect((s.counterexamples as any[])[0].witness).toEqual({ x: 0 });
        expect((s.counterexamples as any[])[4].witness).toEqual({ x: 4 });
    });

    it('serializes counterexample fields correctly', () => {
        const report: RandomTestReport = {
            totalTests: 1,
            passed: 0,
            failed: 1,
            skipped: 0,
            preconditionSkipped: 0,
            classification: 'falsified',
            time: 0.01,
            counterexamples: [{ passed: false, witness: { a: 3, b: 7 }, evaluated: 21 }],
        };
        const ce = (serializeTestReport(report).counterexamples as any[])[0];
        expect(ce).toEqual({ passed: false, witness: { a: 3, b: 7 }, evaluated: 21 });
    });

    it('handles zero counterexamples', () => {
        const report: RandomTestReport = {
            totalTests: 50,
            passed: 50,
            failed: 0,
            skipped: 0,
            preconditionSkipped: 0,
            classification: 'verified',
            time: 2.0,
            counterexamples: [],
        };
        expect(serializeTestReport(report).counterexamples).toEqual([]);
    });
});
