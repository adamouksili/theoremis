// ─────────────────────────────────────────────────────────────
// Theoremis  ·  LLM Hypothesis Parser Tests
// Tests the JSON→IR deserializer, confidence scorer, and
// hybrid routing logic (without making real LLM calls).
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import {
    deserializeTerm,
    regexConfidence,
    parseStatementHybrid,
    parseStatementLLM,
    refineDocWithLLM,
    extractJsonFromCoTResponse,
} from '../parser/llm-hypothesis';
import { mk } from '../core/ir';
import type { HypothesisDecl, MathDocument, ThmNode } from '../parser/ast';

// ── deserializeTerm ─────────────────────────────────────────

describe('deserializeTerm', () => {
    describe('Var', () => {
        it('deserializes a simple variable', () => {
            const result = deserializeTerm({ tag: 'Var', name: 'x' });
            expect(result).toEqual(mk.var('x'));
        });

        it('deserializes a Greek variable name', () => {
            const result = deserializeTerm({ tag: 'Var', name: 'α' });
            expect(result).toEqual(mk.var('α'));
        });

        it('deserializes standard type names', () => {
            expect(deserializeTerm({ tag: 'Var', name: 'ℕ' })).toEqual(mk.var('ℕ'));
            expect(deserializeTerm({ tag: 'Var', name: 'ℤ' })).toEqual(mk.var('ℤ'));
            expect(deserializeTerm({ tag: 'Var', name: 'ℝ' })).toEqual(mk.var('ℝ'));
        });

        it('returns null for missing name', () => {
            expect(deserializeTerm({ tag: 'Var' })).toBeNull();
        });

        it('returns null for non-string name', () => {
            expect(deserializeTerm({ tag: 'Var', name: 42 })).toBeNull();
        });
    });

    describe('Literal', () => {
        it('deserializes Nat literal', () => {
            const result = deserializeTerm({ tag: 'Literal', kind: 'Nat', value: '42' });
            expect(result).toEqual(mk.nat(42));
        });

        it('deserializes Int literal', () => {
            const result = deserializeTerm({ tag: 'Literal', kind: 'Int', value: '-7' });
            expect(result).toEqual(mk.int(-7));
        });

        it('deserializes Bool literal (true)', () => {
            const result = deserializeTerm({ tag: 'Literal', kind: 'Bool', value: 'true' });
            expect(result).toEqual(mk.bool(true));
        });

        it('deserializes Bool literal (false)', () => {
            const result = deserializeTerm({ tag: 'Literal', kind: 'Bool', value: 'false' });
            expect(result).toEqual(mk.bool(false));
        });

        it('returns raw literal for unknown kind', () => {
            const result = deserializeTerm({ tag: 'Literal', kind: 'String', value: 'hello' });
            expect(result).toEqual({ tag: 'Literal', kind: 'String', value: 'hello' });
        });

        it('returns null for missing kind', () => {
            expect(deserializeTerm({ tag: 'Literal', value: '5' })).toBeNull();
        });

        it('returns null for missing value', () => {
            expect(deserializeTerm({ tag: 'Literal', kind: 'Nat' })).toBeNull();
        });
    });

    describe('App', () => {
        it('deserializes simple application (Prime(p))', () => {
            const json = {
                tag: 'App',
                func: { tag: 'Var', name: 'Prime' },
                arg: { tag: 'Var', name: 'p' },
            };
            const result = deserializeTerm(json);
            expect(result).toEqual(mk.app(mk.var('Prime'), mk.var('p')));
        });

        it('deserializes curried application (Coprime(a, b))', () => {
            const json = {
                tag: 'App',
                func: {
                    tag: 'App',
                    func: { tag: 'Var', name: 'Coprime' },
                    arg: { tag: 'Var', name: 'a' },
                },
                arg: { tag: 'Var', name: 'b' },
            };
            const result = deserializeTerm(json);
            expect(result).toEqual(
                mk.app(mk.app(mk.var('Coprime'), mk.var('a')), mk.var('b'))
            );
        });

        it('returns null if func is invalid', () => {
            expect(deserializeTerm({ tag: 'App', func: null, arg: { tag: 'Var', name: 'x' } })).toBeNull();
        });

        it('returns null if arg is invalid', () => {
            expect(deserializeTerm({ tag: 'App', func: { tag: 'Var', name: 'f' }, arg: null })).toBeNull();
        });
    });

    describe('BinOp', () => {
        it('deserializes addition', () => {
            const json = {
                tag: 'BinOp', op: '+',
                left: { tag: 'Var', name: 'a' },
                right: { tag: 'Var', name: 'b' },
            };
            const result = deserializeTerm(json);
            expect(result).toEqual(mk.binOp('+', mk.var('a'), mk.var('b')));
        });

        it('deserializes membership', () => {
            const json = {
                tag: 'BinOp', op: '∈',
                left: { tag: 'Var', name: 'x' },
                right: { tag: 'Var', name: 'S' },
            };
            expect(deserializeTerm(json)).toEqual(mk.binOp('∈', mk.var('x'), mk.var('S')));
        });

        it('deserializes exponentiation', () => {
            const json = {
                tag: 'BinOp', op: '^',
                left: { tag: 'Var', name: 'x' },
                right: { tag: 'Literal', kind: 'Nat', value: '2' },
            };
            expect(deserializeTerm(json)).toEqual(mk.binOp('^', mk.var('x'), mk.nat(2)));
        });

        it('deserializes mod', () => {
            const json = {
                tag: 'BinOp', op: 'mod',
                left: { tag: 'Var', name: 'n' },
                right: { tag: 'Literal', kind: 'Nat', value: '4' },
            };
            expect(deserializeTerm(json)).toEqual(mk.binOp('mod', mk.var('n'), mk.nat(4)));
        });

        it('returns null for missing op', () => {
            const json = { tag: 'BinOp', left: { tag: 'Var', name: 'a' }, right: { tag: 'Var', name: 'b' } };
            expect(deserializeTerm(json)).toBeNull();
        });

        it('returns null for invalid left', () => {
            expect(deserializeTerm({ tag: 'BinOp', op: '+', left: null, right: { tag: 'Var', name: 'b' } })).toBeNull();
        });
    });

    describe('UnaryOp', () => {
        it('deserializes negation', () => {
            const json = {
                tag: 'UnaryOp', op: '¬',
                operand: { tag: 'Var', name: 'P' },
            };
            expect(deserializeTerm(json)).toEqual(mk.unaryOp('¬', mk.var('P')));
        });

        it('deserializes unary minus', () => {
            const json = {
                tag: 'UnaryOp', op: '-',
                operand: { tag: 'Var', name: 'x' },
            };
            expect(deserializeTerm(json)).toEqual(mk.unaryOp('-', mk.var('x')));
        });

        it('returns null for missing operand', () => {
            expect(deserializeTerm({ tag: 'UnaryOp', op: '¬' })).toBeNull();
        });

        it('returns null for missing op', () => {
            expect(deserializeTerm({ tag: 'UnaryOp', operand: { tag: 'Var', name: 'x' } })).toBeNull();
        });
    });

    describe('ForAll', () => {
        it('deserializes universal quantifier', () => {
            const json = {
                tag: 'ForAll', param: 'n',
                domain: { tag: 'Var', name: 'ℕ' },
                body: {
                    tag: 'BinOp', op: '≥',
                    left: { tag: 'Var', name: 'n' },
                    right: { tag: 'Literal', kind: 'Nat', value: '0' },
                },
            };
            expect(deserializeTerm(json)).toEqual(
                mk.forAll('n', mk.var('ℕ'), mk.binOp('≥', mk.var('n'), mk.nat(0)))
            );
        });

        it('returns null for missing param', () => {
            expect(deserializeTerm({
                tag: 'ForAll',
                domain: { tag: 'Var', name: 'ℕ' },
                body: { tag: 'Var', name: 'x' },
            })).toBeNull();
        });
    });

    describe('Exists', () => {
        it('deserializes existential quantifier', () => {
            const json = {
                tag: 'Exists', param: 'k',
                domain: { tag: 'Var', name: 'ℤ' },
                body: {
                    tag: 'BinOp', op: '=',
                    left: { tag: 'Var', name: 'n' },
                    right: {
                        tag: 'BinOp', op: '*',
                        left: { tag: 'Literal', kind: 'Nat', value: '2' },
                        right: { tag: 'Var', name: 'k' },
                    },
                },
            };
            const result = deserializeTerm(json);
            expect(result).toEqual(
                mk.exists('k', mk.var('ℤ'),
                    mk.binOp('=', mk.var('n'), mk.binOp('*', mk.nat(2), mk.var('k')))
                )
            );
        });
    });

    describe('Pi', () => {
        it('deserializes dependent function type', () => {
            const json = {
                tag: 'Pi', param: 'n',
                paramType: { tag: 'Var', name: 'ℕ' },
                body: { tag: 'Var', name: 'Vec' },
            };
            expect(deserializeTerm(json)).toEqual(
                mk.pi('n', mk.var('ℕ'), mk.var('Vec'))
            );
        });
    });

    describe('Lam', () => {
        it('deserializes lambda abstraction', () => {
            const json = {
                tag: 'Lam', param: 'x',
                paramType: { tag: 'Var', name: 'ℝ' },
                body: {
                    tag: 'BinOp', op: '*',
                    left: { tag: 'Var', name: 'x' },
                    right: { tag: 'Var', name: 'x' },
                },
            };
            expect(deserializeTerm(json)).toEqual(
                mk.lam('x', mk.var('ℝ'), mk.binOp('*', mk.var('x'), mk.var('x')))
            );
        });
    });

    describe('Sigma', () => {
        it('deserializes dependent pair type', () => {
            const json = {
                tag: 'Sigma', param: 'x',
                paramType: { tag: 'Var', name: 'ℕ' },
                body: { tag: 'App', func: { tag: 'Var', name: 'Even' }, arg: { tag: 'Var', name: 'x' } },
            };
            expect(deserializeTerm(json)).toEqual(
                mk.sigma('x', mk.var('ℕ'), mk.app(mk.var('Even'), mk.var('x')))
            );
        });
    });

    describe('Equiv', () => {
        it('deserializes equivalence without modulus', () => {
            const json = {
                tag: 'Equiv',
                left: { tag: 'Var', name: 'a' },
                right: { tag: 'Var', name: 'b' },
            };
            expect(deserializeTerm(json)).toEqual(mk.equiv(mk.var('a'), mk.var('b')));
        });

        it('deserializes congruence with modulus', () => {
            const json = {
                tag: 'Equiv',
                left: { tag: 'Var', name: 'a' },
                right: { tag: 'Var', name: 'b' },
                modulus: { tag: 'Var', name: 'n' },
            };
            expect(deserializeTerm(json)).toEqual(mk.equiv(mk.var('a'), mk.var('b'), mk.var('n')));
        });
    });

    describe('Pair', () => {
        it('deserializes a pair', () => {
            const json = {
                tag: 'Pair',
                fst: { tag: 'Literal', kind: 'Nat', value: '1' },
                snd: { tag: 'Literal', kind: 'Nat', value: '2' },
            };
            expect(deserializeTerm(json)).toEqual(mk.pair(mk.nat(1), mk.nat(2)));
        });
    });

    describe('Proj', () => {
        it('deserializes first projection', () => {
            const json = {
                tag: 'Proj',
                term: { tag: 'Var', name: 'p' },
                index: 1,
            };
            expect(deserializeTerm(json)).toEqual(mk.proj(mk.var('p'), 1));
        });

        it('deserializes second projection', () => {
            const json = {
                tag: 'Proj',
                term: { tag: 'Var', name: 'p' },
                index: 2,
            };
            expect(deserializeTerm(json)).toEqual(mk.proj(mk.var('p'), 2));
        });

        it('returns null for invalid index', () => {
            expect(deserializeTerm({ tag: 'Proj', term: { tag: 'Var', name: 'p' }, index: 3 })).toBeNull();
        });
    });

    describe('LetIn', () => {
        it('deserializes let binding', () => {
            const json = {
                tag: 'LetIn', name: 'x',
                type: { tag: 'Var', name: 'ℕ' },
                value: { tag: 'Literal', kind: 'Nat', value: '5' },
                body: {
                    tag: 'BinOp', op: '+',
                    left: { tag: 'Var', name: 'x' },
                    right: { tag: 'Literal', kind: 'Nat', value: '1' },
                },
            };
            expect(deserializeTerm(json)).toEqual(
                mk.letIn('x', mk.var('ℕ'), mk.nat(5), mk.binOp('+', mk.var('x'), mk.nat(1)))
            );
        });

        it('returns null for missing name', () => {
            expect(deserializeTerm({
                tag: 'LetIn',
                type: { tag: 'Var', name: 'ℕ' },
                value: { tag: 'Literal', kind: 'Nat', value: '5' },
                body: { tag: 'Var', name: 'x' },
            })).toBeNull();
        });
    });

    describe('Sort', () => {
        it('deserializes Prop', () => {
            const json = { tag: 'Sort', universe: { tag: 'Prop' } };
            expect(deserializeTerm(json)).toEqual(mk.sort({ tag: 'Prop' }));
        });

        it('deserializes Type with level', () => {
            const json = { tag: 'Sort', universe: { tag: 'Type', level: 1 } };
            expect(deserializeTerm(json)).toEqual(mk.sort({ tag: 'Type', level: 1 }));
        });

        it('deserializes Type with default level 0', () => {
            const json = { tag: 'Sort', universe: { tag: 'Type' } };
            expect(deserializeTerm(json)).toEqual(mk.sort({ tag: 'Type', level: 0 }));
        });

        it('returns null for missing universe', () => {
            expect(deserializeTerm({ tag: 'Sort' })).toBeNull();
        });
    });

    describe('Hole', () => {
        it('deserializes hole with id', () => {
            expect(deserializeTerm({ tag: 'Hole', id: 'goal_1' })).toEqual(mk.hole('goal_1'));
        });

        it('deserializes hole without id (defaults to ?)', () => {
            expect(deserializeTerm({ tag: 'Hole' })).toEqual(mk.hole('?'));
        });
    });

    describe('error cases', () => {
        it('returns null for null input', () => {
            expect(deserializeTerm(null)).toBeNull();
        });

        it('returns null for undefined input', () => {
            expect(deserializeTerm(undefined)).toBeNull();
        });

        it('returns null for number input', () => {
            expect(deserializeTerm(42)).toBeNull();
        });

        it('returns null for string input', () => {
            expect(deserializeTerm('hello')).toBeNull();
        });

        it('returns null for unknown tag', () => {
            expect(deserializeTerm({ tag: 'Unknown', data: 123 })).toBeNull();
        });

        it('returns null for missing tag', () => {
            expect(deserializeTerm({ name: 'x' })).toBeNull();
        });
    });

    describe('complex nested terms', () => {
        it('deserializes ForAll n : ℕ, Exists k : ℕ, n = 2*k', () => {
            const json = {
                tag: 'ForAll', param: 'n',
                domain: { tag: 'Var', name: 'ℕ' },
                body: {
                    tag: 'Exists', param: 'k',
                    domain: { tag: 'Var', name: 'ℕ' },
                    body: {
                        tag: 'BinOp', op: '=',
                        left: { tag: 'Var', name: 'n' },
                        right: {
                            tag: 'BinOp', op: '*',
                            left: { tag: 'Literal', kind: 'Nat', value: '2' },
                            right: { tag: 'Var', name: 'k' },
                        },
                    },
                },
            };
            const result = deserializeTerm(json);
            expect(result).toEqual(
                mk.forAll('n', mk.var('ℕ'),
                    mk.exists('k', mk.var('ℕ'),
                        mk.binOp('=', mk.var('n'), mk.binOp('*', mk.nat(2), mk.var('k')))
                    )
                )
            );
        });

        it('deserializes Prime(p) ∧ p > 2 → Odd(p)', () => {
            const json = {
                tag: 'BinOp', op: '→',
                left: {
                    tag: 'BinOp', op: '∧',
                    left: {
                        tag: 'App',
                        func: { tag: 'Var', name: 'Prime' },
                        arg: { tag: 'Var', name: 'p' },
                    },
                    right: {
                        tag: 'BinOp', op: '>',
                        left: { tag: 'Var', name: 'p' },
                        right: { tag: 'Literal', kind: 'Nat', value: '2' },
                    },
                },
                right: {
                    tag: 'App',
                    func: { tag: 'Var', name: 'Odd' },
                    arg: { tag: 'Var', name: 'p' },
                },
            };
            const result = deserializeTerm(json);
            expect(result).toBeTruthy();
            expect(result?.tag).toBe('BinOp');
        });
    });
});

// ── regexConfidence ─────────────────────────────────────────

describe('regexConfidence', () => {
    const mkHyp = (n: string): HypothesisDecl => ({
        name: n,
        condition: mk.var(n),
        description: `${n} is something`,
    });

    it('returns high confidence for simple let-binding with good conclusion', () => {
        const text = 'Let $p$ be a prime number.';
        const hyps = [mkHyp('p')];
        const score = regexConfidence(text, hyps, 'BinOp');
        expect(score).toBeGreaterThanOrEqual(0.5);
    });

    it('returns low confidence for empty hypotheses with bare Var conclusion', () => {
        const text = 'For all coprime integers a and b such that a divides b and b divides a, we have a = b.';
        const score = regexConfidence(text, [], 'Var');
        expect(score).toBeLessThan(0.5);
    });

    it('penalizes "such that" + "for all" combinations', () => {
        const text = 'For all primes p such that p > 2, there exists q.';
        const s1 = regexConfidence(text, [mkHyp('p')], 'Exists');
        const simple = 'Let $p$ be prime.';
        const s2 = regexConfidence(simple, [mkHyp('p')], 'BinOp');
        expect(s2).toBeGreaterThanOrEqual(s1);
    });

    it('penalizes "respectively"', () => {
        const text = 'Let $a$, $b$, $c$ be elements of $G$, $H$, $K$ respectively.';
        const score = regexConfidence(text, [mkHyp('a')], 'Var');
        expect(score).toBeLessThan(0.7);
    });

    it('penalizes "if and only if"', () => {
        const text = 'A number is prime if and only if it has exactly two divisors.';
        const score = regexConfidence(text, [], 'Var');
        expect(score).toBeLessThan(0.3);
    });

    it('gives bonus for simple "Let $..." pattern', () => {
        const s1 = regexConfidence('Let $n \\in \\mathbb{N}$.', [mkHyp('n')], 'Var');
        const s2 = regexConfidence('Assume blah blah.', [mkHyp('n')], 'Var');
        expect(s1).toBeGreaterThanOrEqual(s2);
    });

    it('gives bonus for "For all/every/each" patterns', () => {
        const text = 'For every integer $n > 0$, there exists a prime $p$ dividing $n$.';
        const score = regexConfidence(text, [mkHyp('n')], 'Exists');
        expect(score).toBeGreaterThan(0.2);
    });

    it('penalizes double "for all" quantifiers', () => {
        const text = 'For all integers m, for all primes p, m^p is odd.';
        const score = regexConfidence(text, [mkHyp('m'), mkHyp('p')], 'BinOp');
        // Still should be reasonable since we got hypotheses
        expect(score).toBeLessThanOrEqual(0.9);
    });

    it('clamps score to [0, 1]', () => {
        // Many bonuses
        const text = 'Let $p$ be prime. For all $n$, we have $n > 0$.';
        const score = regexConfidence(
            text,
            [mkHyp('p'), mkHyp('n'), mkHyp('q'), mkHyp('r')],
            'BinOp'
        );
        expect(score).toBeLessThanOrEqual(1);
        expect(score).toBeGreaterThanOrEqual(0);
    });
});

// ── extractJsonFromCoTResponse ──────────────────────────────

describe('extractJsonFromCoTResponse', () => {
    it('extracts JSON from a CoT response with thought_process block', () => {
        const content = `<thought_process>
VARIABLES:
- p: prime → domain ℕ

CONDITIONS:
1. p is prime

CONCLUSION: p > 0

CROSS-CHECK: 1 condition. ✓
</thought_process>
{"hypotheses":[{"name":"h_0","condition":{"tag":"Var","name":"p"},"description":"p is prime"}],"conclusion":{"tag":"Var","name":"X"}}`;

        const result = extractJsonFromCoTResponse(content);
        expect(result).toBeTruthy();
        const parsed = JSON.parse(result!);
        expect(parsed.hypotheses).toHaveLength(1);
        expect(parsed.hypotheses[0].name).toBe('h_0');
    });

    it('handles plain JSON (no thought_process block)', () => {
        const json = '{"hypotheses":[],"conclusion":{"tag":"Var","name":"X"}}';
        const result = extractJsonFromCoTResponse(json);
        expect(result).toBe(json);
    });

    it('handles markdown-wrapped JSON after thought_process', () => {
        const content = `<thought_process>Some thinking...</thought_process>
\`\`\`json
{"hypotheses":[],"conclusion":{"tag":"Var","name":"X"}}
\`\`\``;

        const result = extractJsonFromCoTResponse(content);
        expect(result).toBeTruthy();
        const parsed = JSON.parse(result!);
        expect(parsed.conclusion.name).toBe('X');
    });

    it('handles markdown-wrapped JSON without thought_process', () => {
        const content = '```json\n{"hypotheses":[],"conclusion":{"tag":"Var","name":"Y"}}\n```';
        const result = extractJsonFromCoTResponse(content);
        expect(result).toBeTruthy();
        const parsed = JSON.parse(result!);
        expect(parsed.conclusion.name).toBe('Y');
    });

    it('returns null for empty content', () => {
        expect(extractJsonFromCoTResponse('')).toBeNull();
    });

    it('returns null for content with only thought_process and no JSON', () => {
        expect(extractJsonFromCoTResponse('<thought_process>Just thinking</thought_process>')).toBeNull();
    });

    it('returns null for content with no braces', () => {
        expect(extractJsonFromCoTResponse('No JSON here at all')).toBeNull();
    });

    it('extracts JSON even with stray text after thought_process', () => {
        const content = `<thought_process>Analysis done.</thought_process>

Here is the result:
{"hypotheses":[],"conclusion":{"tag":"Var","name":"Z"}}
Some trailing text.`;

        const result = extractJsonFromCoTResponse(content);
        expect(result).toBeTruthy();
        const parsed = JSON.parse(result!);
        expect(parsed.conclusion.name).toBe('Z');
    });

    it('handles multiple thought_process blocks (strips all)', () => {
        const content = `<thought_process>First pass</thought_process>
<thought_process>Second pass with correction</thought_process>
{"hypotheses":[],"conclusion":{"tag":"Var","name":"W"}}`;

        const result = extractJsonFromCoTResponse(content);
        expect(result).toBeTruthy();
        const parsed = JSON.parse(result!);
        expect(parsed.conclusion.name).toBe('W');
    });

    it('handles thought_process with JSON-like content inside', () => {
        const content = `<thought_process>
The variable looks like {"tag":"Var","name":"x"} but this is just my notes.
</thought_process>
{"hypotheses":[{"name":"h_0","condition":{"tag":"Var","name":"x"},"description":"x"}],"conclusion":{"tag":"Var","name":"Q"}}`;

        const result = extractJsonFromCoTResponse(content);
        expect(result).toBeTruthy();
        const parsed = JSON.parse(result!);
        // Should parse the OUTER JSON, not the one inside thought_process
        expect(parsed.conclusion.name).toBe('Q');
        expect(parsed.hypotheses).toHaveLength(1);
    });
});

// ── parseStatementLLM ───────────────────────────────────────

describe('parseStatementLLM', () => {
    it('returns null on fetch failure', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await parseStatementLLM('Let $p$ be prime.', 'fake-key');
        expect(result).toBeNull();

        globalThis.fetch = originalFetch;
    });

    it('returns null on non-ok response', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
        });

        const result = await parseStatementLLM('Let $p$ be prime.', 'fake-key');
        expect(result).toBeNull();

        globalThis.fetch = originalFetch;
    });

    it('returns null on empty content', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ choices: [{ message: { content: '' } }] }),
        });

        const result = await parseStatementLLM('Let $p$ be prime.', 'fake-key');
        expect(result).toBeNull();

        globalThis.fetch = originalFetch;
    });

    it('returns null on invalid JSON response', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: 'this is not json' } }],
            }),
        });

        const result = await parseStatementLLM('Let $p$ be prime.', 'fake-key');
        expect(result).toBeNull();

        globalThis.fetch = originalFetch;
    });

    it('correctly deserializes a well-formed LLM response', async () => {
        const llmResponse = JSON.stringify({
            hypotheses: [
                {
                    name: 'h_0',
                    condition: { tag: 'App', func: { tag: 'Var', name: 'Prime' }, arg: { tag: 'Var', name: 'p' } },
                    description: 'p is prime',
                },
            ],
            conclusion: {
                tag: 'BinOp', op: '>',
                left: { tag: 'Var', name: 'p' },
                right: { tag: 'Literal', kind: 'Nat', value: '0' },
            },
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: llmResponse } }],
            }),
        });

        const result = await parseStatementLLM('Let $p$ be a prime. Then $p > 0$.', 'fake-key');
        expect(result).toBeTruthy();
        expect(result?.source).toBe('llm');
        expect(result?.hypotheses).toHaveLength(1);
        expect(result?.hypotheses[0].name).toBe('h_0');
        expect(result?.hypotheses[0].condition).toEqual(mk.app(mk.var('Prime'), mk.var('p')));
        expect(result?.conclusion).toEqual(mk.binOp('>', mk.var('p'), mk.nat(0)));

        globalThis.fetch = originalFetch;
    });

    it('correctly handles a full CoT response with thought_process block', async () => {
        const cotResponse = `<thought_process>
VARIABLES:
- n: "prime" → domain ℕ
- k: "integer" with k > 0 and k ≠ n → domain ℤ

CONDITIONS:
1. n is prime → App(Var("Prime"), Var("n"))
2. k ∈ ℤ → BinOp("∈", Var("k"), Var("ℤ"))
3. k > 0 → BinOp(">", Var("k"), Literal(Nat, "0"))
4. k ≠ n → UnaryOp("¬", BinOp("=", Var("k"), Var("n")))

CONCLUSION: n divides k → App(App(Var("Divides"), Var("n")), Var("k"))

CROSS-CHECK: 4 conditions. ✓
</thought_process>
${JSON.stringify({
    hypotheses: [
        { name: 'h_0', condition: { tag: 'App', func: { tag: 'Var', name: 'Prime' }, arg: { tag: 'Var', name: 'n' } }, description: 'n is prime' },
        { name: 'h_1', condition: { tag: 'BinOp', op: '∈', left: { tag: 'Var', name: 'k' }, right: { tag: 'Var', name: 'ℤ' } }, description: 'k is an integer' },
        { name: 'h_2', condition: { tag: 'BinOp', op: '>', left: { tag: 'Var', name: 'k' }, right: { tag: 'Literal', kind: 'Nat', value: '0' } }, description: 'k is positive' },
        { name: 'h_3', condition: { tag: 'UnaryOp', op: '¬', operand: { tag: 'BinOp', op: '=', left: { tag: 'Var', name: 'k' }, right: { tag: 'Var', name: 'n' } } }, description: 'k ≠ n' },
    ],
    conclusion: { tag: 'App', func: { tag: 'App', func: { tag: 'Var', name: 'Divides' }, arg: { tag: 'Var', name: 'n' } }, arg: { tag: 'Var', name: 'k' } },
})}`;

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: cotResponse } }],
            }),
        });

        const result = await parseStatementLLM('Let n be prime and k > 0 an integer where k ≠ n. Then n divides k.', 'fake-key');
        expect(result).toBeTruthy();
        expect(result?.source).toBe('llm');
        expect(result?.hypotheses).toHaveLength(4);
        expect(result?.hypotheses[0].name).toBe('h_0');
        expect(result?.hypotheses[0].condition).toEqual(mk.app(mk.var('Prime'), mk.var('n')));
        expect(result?.hypotheses[1].condition).toEqual(mk.binOp('∈', mk.var('k'), mk.var('ℤ')));
        expect(result?.hypotheses[2].condition).toEqual(mk.binOp('>', mk.var('k'), mk.nat(0)));
        expect(result?.hypotheses[3].condition).toEqual(mk.unaryOp('¬', mk.binOp('=', mk.var('k'), mk.var('n'))));
        expect(result?.conclusion).toEqual(mk.app(mk.app(mk.var('Divides'), mk.var('n')), mk.var('k')));

        globalThis.fetch = originalFetch;
    });

    it('handles markdown-wrapped JSON response', async () => {
        const llmResponse = '```json\n' + JSON.stringify({
            hypotheses: [],
            conclusion: { tag: 'Var', name: 'P' },
        }) + '\n```';

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: llmResponse } }],
            }),
        });

        const result = await parseStatementLLM('P is true.', 'fake-key');
        expect(result).toBeTruthy();
        expect(result?.conclusion).toEqual(mk.var('P'));

        globalThis.fetch = originalFetch;
    });

    it('uses GitHub Models endpoint for github_pat_ tokens', async () => {
        const originalFetch = globalThis.fetch;
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: JSON.stringify({
                    hypotheses: [],
                    conclusion: { tag: 'Var', name: 'X' },
                }) } }],
            }),
        });
        globalThis.fetch = mockFetch;

        await parseStatementLLM('X.', 'github_pat_FAKETOKEN123');

        expect(mockFetch).toHaveBeenCalledWith(
            'https://models.inference.ai.azure.com/chat/completions',
            expect.objectContaining({
                body: expect.stringContaining('"model":"gpt-4o"'),
            })
        );

        globalThis.fetch = originalFetch;
    });

    it('uses GitHub Models endpoint for ghp_ tokens', async () => {
        const originalFetch = globalThis.fetch;
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: JSON.stringify({
                    hypotheses: [],
                    conclusion: { tag: 'Var', name: 'X' },
                }) } }],
            }),
        });
        globalThis.fetch = mockFetch;

        await parseStatementLLM('X.', 'ghp_FAKETOKEN456');

        expect(mockFetch).toHaveBeenCalledWith(
            'https://models.inference.ai.azure.com/chat/completions',
            expect.objectContaining({
                body: expect.stringContaining('"model":"gpt-4o"'),
            })
        );

        globalThis.fetch = originalFetch;
    });

    it('uses OpenAI endpoint for other API keys', async () => {
        const originalFetch = globalThis.fetch;
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: JSON.stringify({
                    hypotheses: [],
                    conclusion: { tag: 'Var', name: 'X' },
                }) } }],
            }),
        });
        globalThis.fetch = mockFetch;

        await parseStatementLLM('X.', 'sk-some-openai-key');

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.openai.com/v1/chat/completions',
            expect.objectContaining({
                body: expect.stringContaining('"model":"gpt-4o-mini"'),
            })
        );

        globalThis.fetch = originalFetch;
    });

    it('uses custom endpoint when provided', async () => {
        const originalFetch = globalThis.fetch;
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: JSON.stringify({
                    hypotheses: [],
                    conclusion: { tag: 'Var', name: 'X' },
                }) } }],
            }),
        });
        globalThis.fetch = mockFetch;

        await parseStatementLLM('X.', 'any-key', 'https://custom.api/v1/chat');

        expect(mockFetch).toHaveBeenCalledWith(
            'https://custom.api/v1/chat',
            expect.anything()
        );

        globalThis.fetch = originalFetch;
    });

    it('skips hypotheses with invalid conditions', async () => {
        const llmResponse = JSON.stringify({
            hypotheses: [
                { name: 'h_0', condition: { tag: 'Var', name: 'p' }, description: 'ok' },
                { name: 'h_1', condition: null, description: 'bad' },
                { name: 'h_2', condition: { tag: 'Var', name: 'q' }, description: 'ok' },
            ],
            conclusion: { tag: 'Var', name: 'R' },
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: llmResponse } }],
            }),
        });

        const result = await parseStatementLLM('P Q R.', 'fake-key');
        expect(result?.hypotheses).toHaveLength(2);
        expect(result?.hypotheses[0].name).toBe('h_0');
        expect(result?.hypotheses[1].name).toBe('h_2');

        globalThis.fetch = originalFetch;
    });

    it('returns null when conclusion cannot be deserialized', async () => {
        const llmResponse = JSON.stringify({
            hypotheses: [{ name: 'h_0', condition: { tag: 'Var', name: 'p' }, description: 'p' }],
            conclusion: { tag: 'Bogus' },
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: llmResponse } }],
            }),
        });

        const result = await parseStatementLLM('Some statement.', 'fake-key');
        expect(result).toBeNull();

        globalThis.fetch = originalFetch;
    });
});

// ── parseStatementHybrid ────────────────────────────────────

describe('parseStatementHybrid', () => {
    const regexResult = {
        hypotheses: [{ name: 'p', condition: mk.app(mk.var('Prime'), mk.var('p')), description: 'p is prime' }],
        conclusion: mk.binOp('>', mk.var('p'), mk.nat(0)),
    };

    it('returns regex result when confidence is high', async () => {
        const result = await parseStatementHybrid(
            'Let $p$ be a prime number. Then $p > 0$.',
            regexResult,
            null,
        );
        expect(result.source).toBe('regex');
        expect(result.hypotheses).toEqual(regexResult.hypotheses);
    });

    it('returns regex result when no API key is provided', async () => {
        const weakResult = { hypotheses: [], conclusion: mk.var('X') };
        const result = await parseStatementHybrid(
            'For all coprime integers such that blah blah respectively if and only if blah.',
            weakResult,
            null,
        );
        expect(result.source).toBe('regex');
    });

    it('falls back to regex when LLM fails', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('fail'));

        const weakResult = { hypotheses: [], conclusion: mk.var('X') };
        const result = await parseStatementHybrid(
            'For all coprime integers such that blah blah respectively if and only if blah.',
            weakResult,
            'fake-key',
        );
        expect(result.source).toBe('regex');

        globalThis.fetch = originalFetch;
    });

    it('uses LLM result when regex confidence is low and LLM succeeds', async () => {
        const llmResponse = JSON.stringify({
            hypotheses: [
                {
                    name: 'h_0',
                    condition: {
                        tag: 'App',
                        func: {
                            tag: 'App',
                            func: { tag: 'Var', name: 'Coprime' },
                            arg: { tag: 'Var', name: 'a' },
                        },
                        arg: { tag: 'Var', name: 'b' },
                    },
                    description: 'a and b are coprime',
                },
            ],
            conclusion: {
                tag: 'BinOp', op: '=',
                left: { tag: 'Var', name: 'a' },
                right: { tag: 'Var', name: 'b' },
            },
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: llmResponse } }],
            }),
        });

        const weakResult = { hypotheses: [], conclusion: mk.var('X') };
        const result = await parseStatementHybrid(
            'For all coprime integers a and b such that a divides b and b divides a respectively, if and only if they are equal.',
            weakResult,
            'fake-key',
        );
        expect(result.source).toBe('llm');
        expect(result.hypotheses).toHaveLength(1);

        globalThis.fetch = originalFetch;
    });

    it('falls back to regex when LLM returns only a bare Var conclusion', async () => {
        const llmResponse = JSON.stringify({
            hypotheses: [],
            conclusion: { tag: 'Var', name: 'X' },
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: llmResponse } }],
            }),
        });

        // Use a weak regex result but add a hypothesis to make it still
        // more useful than the empty LLM result
        const weakRegex = {
            hypotheses: [{ name: 'a', condition: mk.var('a'), description: 'a' }],
            conclusion: mk.var('Y'),
        };
        const result = await parseStatementHybrid(
            'For all integers such that blah respectively if and only if blah.',
            weakRegex,
            'fake-key',
        );
        // LLM returned bare Var with no hypotheses → falls back
        expect(result.source).toBe('regex');

        globalThis.fetch = originalFetch;
    });
});

// ── refineDocWithLLM ────────────────────────────────────────

describe('refineDocWithLLM', () => {
    const makeDoc = (rawLatex: string): MathDocument => ({
        title: 'Test',
        nodes: [{
            tag: 'ThmNode',
            name: 'T1',
            label: 'T1',
            hypotheses: [],
            conclusion: mk.var('X'),
            proof: null,
            rawLatex,
            line: 1,
        } as ThmNode],
        dependencies: [],
        rawSource: rawLatex,
    });

    const thmNode = (doc: MathDocument) => doc.nodes[0] as ThmNode;

    it('returns unchanged doc when no API key provided', async () => {
        const doc = makeDoc('Let $p$ be prime.');
        const result = await refineDocWithLLM(doc, null);
        expect(result.refined).toBe(0);
        expect(result.doc).toBe(doc);
    });

    it('does not refine high-confidence theorems', async () => {
        // "Let $p$ be a prime" is high-confidence for regex
        const doc = makeDoc('Let $p$ be a prime number. Then $p > 0$.');
        // Manually give it a real hypothesis so confidence is high
        const thm = thmNode(doc);
        thm.hypotheses = [{
            name: 'p',
            condition: mk.app(mk.var('Prime'), mk.var('p')),
            description: 'p is prime',
        }];
        thm.conclusion = mk.binOp('>', mk.var('p'), mk.nat(0));

        const originalFetch = globalThis.fetch;
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch;

        const result = await refineDocWithLLM(doc, 'fake-key');
        // Should NOT call LLM since confidence is high
        expect(mockFetch).not.toHaveBeenCalled();
        expect(result.refined).toBe(0);

        globalThis.fetch = originalFetch;
    });

    it('refines low-confidence theorems via LLM', async () => {
        const doc = makeDoc('For all coprime integers a and b such that a divides b respectively, if and only if a = b.');

        const llmResponse = JSON.stringify({
            hypotheses: [{
                name: 'h_0',
                condition: {
                    tag: 'App',
                    func: { tag: 'App', func: { tag: 'Var', name: 'Coprime' }, arg: { tag: 'Var', name: 'a' } },
                    arg: { tag: 'Var', name: 'b' },
                },
                description: 'a and b are coprime',
            }],
            conclusion: {
                tag: 'BinOp', op: '=',
                left: { tag: 'Var', name: 'a' },
                right: { tag: 'Var', name: 'b' },
            },
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: llmResponse } }],
            }),
        });

        const result = await refineDocWithLLM(doc, 'fake-key');
        expect(result.refined).toBe(1);
        expect(result.total).toBe(1);
        const thm = thmNode(doc);
        expect(thm.hypotheses).toHaveLength(1);
        expect(thm.hypotheses[0].name).toBe('h_0');
        expect(thm.conclusion.tag).toBe('BinOp');

        globalThis.fetch = originalFetch;
    });

    it('recursively processes SectionNode children', async () => {
        const doc = {
            title: 'Test',
            nodes: [{
                tag: 'SectionNode' as const,
                title: 'Section 1',
                children: [{
                    tag: 'ThmNode' as const,
                    name: 'T1',
                    label: 'T1',
                    hypotheses: [],
                    conclusion: mk.var('X'),
                    proof: null,
                    rawLatex: 'For all coprime integers such that blah respectively if and only if blah.',
                    line: 1,
                }],
                line: 1,
            }],
            dependencies: [],
            rawSource: '',
        };

        const llmResponse = JSON.stringify({
            hypotheses: [{ name: 'h_0', condition: { tag: 'Var', name: 'a' }, description: 'a' }],
            conclusion: { tag: 'BinOp', op: '=', left: { tag: 'Var', name: 'a' }, right: { tag: 'Var', name: 'b' } },
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ choices: [{ message: { content: llmResponse } }] }),
        });

        const result = await refineDocWithLLM(doc, 'fake-key');
        expect(result.refined).toBe(1);

        globalThis.fetch = originalFetch;
    });

    it('skips non-theorem nodes', async () => {
        const doc = {
            title: 'Test',
            nodes: [{
                tag: 'DefNode' as const,
                name: 'D1',
                params: [],
                body: mk.var('x'),
                rawLatex: 'Something.',
                line: 1,
            }],
            dependencies: [],
            rawSource: '',
        };

        const result = await refineDocWithLLM(doc, 'fake-key');
        expect(result.refined).toBe(0);
        expect(result.total).toBe(0);
    });
});
