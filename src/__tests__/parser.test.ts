// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Parser Tests
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { parseExpr, parseLatex, documentToIR } from '../parser/latex';
import type { Term } from '../core/ir';
import type { ThmNode } from '../parser/ast';

// Helper to check name at top level
function varName(t: Term) { return t.tag === 'Var' ? t.name : null; }

describe('parseExpr', () => {
    describe('literals', () => {
        it('parses natural numbers', () => {
            const t = parseExpr('42');
            expect(t.tag).toBe('Literal');
            if (t.tag === 'Literal') {
                expect(t.kind).toBe('Nat');
                expect(t.value).toBe('42');
            }
        });

        it('parses zero', () => {
            const t = parseExpr('0');
            expect(t.tag).toBe('Literal');
        });
    });

    describe('variables', () => {
        it('parses simple variables', () => {
            const t = parseExpr('x');
            expect(t.tag).toBe('Var');
            expect(varName(t)).toBe('x');
        });

        it('parses Greek letters via LaTeX commands', () => {
            const t = parseExpr('\\alpha');
            expect(t.tag).toBe('Var');
            expect(varName(t)).toBe('α');
        });

        it('parses Unicode Greek letters', () => {
            const t = parseExpr('ℕ');
            expect(t.tag).toBe('Var');
            expect(varName(t)).toBe('ℕ');
        });
    });

    describe('arithmetic', () => {
        it('parses addition', () => {
            const t = parseExpr('a + b');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') {
                expect(t.op).toBe('+');
                expect(varName(t.left)).toBe('a');
                expect(varName(t.right)).toBe('b');
            }
        });

        it('parses subtraction', () => {
            const t = parseExpr('x - y');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') expect(t.op).toBe('-');
        });

        it('parses multiplication with \\cdot', () => {
            const t = parseExpr('a \\cdot b');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') expect(t.op).toBe('*');
        });

        it('parses exponentiation', () => {
            const t = parseExpr('a^{n-1}');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') {
                expect(t.op).toBe('^');
                expect(varName(t.left)).toBe('a');
                expect(t.right.tag).toBe('BinOp');
            }
        });

        it('parses fractions', () => {
            const t = parseExpr('\\frac{a}{b}');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') {
                expect(t.op).toBe('/');
                expect(varName(t.left)).toBe('a');
                expect(varName(t.right)).toBe('b');
            }
        });
    });

    describe('operator precedence', () => {
        it('multiplication binds tighter than addition', () => {
            const t = parseExpr('a + b \\cdot c');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') {
                expect(t.op).toBe('+');
                expect(varName(t.left)).toBe('a');
                expect(t.right.tag).toBe('BinOp');
                if (t.right.tag === 'BinOp') {
                    expect(t.right.op).toBe('*');
                }
            }
        });

        it('exponentiation binds tighter than multiplication', () => {
            const t = parseExpr('a \\cdot b^2');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') {
                expect(t.op).toBe('*');
                expect(t.right.tag).toBe('BinOp');
                if (t.right.tag === 'BinOp') {
                    expect(t.right.op).toBe('^');
                }
            }
        });

        it('parentheses override precedence', () => {
            const t = parseExpr('(a + b) \\cdot c');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') {
                expect(t.op).toBe('*');
                expect(t.left.tag).toBe('BinOp');
                if (t.left.tag === 'BinOp') expect(t.left.op).toBe('+');
            }
        });
    });

    describe('comparisons', () => {
        it('parses equality', () => {
            const t = parseExpr('a = b');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') expect(t.op).toBe('=');
        });

        it('parses \\leq', () => {
            const t = parseExpr('x \\leq y');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') expect(t.op).toBe('≤');
        });

        it('parses \\geq', () => {
            const t = parseExpr('x \\geq 0');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') expect(t.op).toBe('≥');
        });

        it('parses strict inequalities', () => {
            const t = parseExpr('p > 1');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') expect(t.op).toBe('>');
        });
    });

    describe('logical connectives', () => {
        it('parses conjunction', () => {
            const t = parseExpr('P \\land Q');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') expect(t.op).toBe('∧');
        });

        it('parses disjunction', () => {
            const t = parseExpr('P \\lor Q');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') expect(t.op).toBe('∨');
        });

        it('parses implication', () => {
            const t = parseExpr('P \\implies Q');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') expect(t.op).toBe('→');
        });

        it('parses iff', () => {
            const t = parseExpr('P \\iff Q');
            expect(t.tag).toBe('BinOp');
            if (t.tag === 'BinOp') expect(t.op).toBe('↔');
        });

        it('parses negation', () => {
            const t = parseExpr('\\neg P');
            expect(t.tag).toBe('UnaryOp');
            if (t.tag === 'UnaryOp') expect(t.op).toBe('¬');
        });
    });

    describe('quantifiers', () => {
        it('parses universal quantifier', () => {
            const t = parseExpr('\\forall x \\in \\mathbb{N}, x \\geq 0');
            expect(t.tag).toBe('ForAll');
            if (t.tag === 'ForAll') {
                expect(t.param).toBe('x');
                expect(varName(t.domain)).toBe('ℕ');
                expect(t.body.tag).toBe('BinOp');
            }
        });

        it('parses existential quantifier', () => {
            const t = parseExpr('\\exists n \\in \\mathbb{Z}, n < 0');
            expect(t.tag).toBe('Exists');
            if (t.tag === 'Exists') {
                expect(t.param).toBe('n');
                expect(varName(t.domain)).toBe('ℤ');
            }
        });
    });

    describe('congruences', () => {
        it('parses modular equivalence with \\pmod', () => {
            const t = parseExpr('a^{p-1} \\equiv 1 \\pmod{p}');
            expect(t.tag).toBe('Equiv');
            if (t.tag === 'Equiv') {
                expect(t.modulus).toBeTruthy();
            }
        });
    });

    describe('special constructs', () => {
        it('parses \\mathbb{R}', () => {
            const t = parseExpr('\\mathbb{R}');
            expect(t.tag).toBe('Var');
            expect(varName(t)).toBe('ℝ');
        });

        it('parses \\mathbb{N}', () => {
            const t = parseExpr('\\mathbb{N}');
            expect(t.tag).toBe('Var');
            expect(varName(t)).toBe('ℕ');
        });

        it('parses \\sqrt{x}', () => {
            const t = parseExpr('\\sqrt{x}');
            expect(t.tag).toBe('App');
        });

        it('handles empty input', () => {
            const t = parseExpr('');
            expect(t.tag).toBe('Hole');
        });
    });
});

describe('parseLatex', () => {
    it('parses theorem environments', () => {
        const doc = parseLatex(`
\\begin{theorem}[My Theorem]
For all $n$, $n \\geq 0$.
\\end{theorem}`);
        expect(doc.nodes.length).toBe(1);
        expect(doc.nodes[0].tag).toBe('ThmNode');
    });

    it('parses definition environments', () => {
        const doc = parseLatex(`
\\begin{definition}[Prime Number]
A natural number $p > 1$ is prime.
\\end{definition}`);
        expect(doc.nodes.length).toBe(1);
        expect(doc.nodes[0].tag).toBe('DefNode');
    });

    it('parses lemma environments', () => {
        const doc = parseLatex(`
\\begin{lemma}[Small Lemma]
$x^2 \\geq 0$
\\end{lemma}`);
        expect(doc.nodes.length).toBe(1);
        expect(doc.nodes[0].tag).toBe('LemmaNode');
    });

    it('attaches proofs to theorems', () => {
        const doc = parseLatex(`
\\begin{theorem}[Test]
$x = x$
\\end{theorem}
\\begin{proof}
By induction on $x$.
\\end{proof}`);
        expect(doc.nodes.length).toBe(1);
        const thm = doc.nodes[0] as ThmNode;
        expect(thm.proof).toBeTruthy();
        expect(thm.proof!.tactics.length).toBeGreaterThan(0);
    });

    it('extracts title', () => {
        const doc = parseLatex(`\\title{My Paper}
\\begin{theorem}[T1]
$x = 0$
\\end{theorem}`);
        expect(doc.title).toBe('My Paper');
    });

    it('handles multiple statements', () => {
        const doc = parseLatex(`
\\begin{definition}[Def1]
A thing.
\\end{definition}
\\begin{theorem}[Thm1]
$1 = 1$
\\end{theorem}
\\begin{lemma}[Lem1]
$0 = 0$
\\end{lemma}`);
        expect(doc.nodes.length).toBe(3);
    });
});

describe('documentToIR', () => {
    it('converts a document with theorem and definition', () => {
        const doc = parseLatex(`
\\begin{definition}[Prime Number]
A natural number $p > 1$ is prime.
\\end{definition}
\\begin{theorem}[Test Theorem]
$\\forall x \\in \\mathbb{N}, x \\geq 0$
\\end{theorem}`);
        const ir = documentToIR(doc);
        expect(ir.declarations.length).toBe(2);
        expect(ir.declarations[0].tag).toBe('Definition');
        expect(ir.declarations[1].tag).toBe('Theorem');
    });

    it('assigns axiom bundle to theorems', () => {
        const doc = parseLatex(`
\\begin{theorem}[T]
$1 = 1$
\\end{theorem}`);
        const ir = documentToIR(doc);
        const thm = ir.declarations[0];
        if (thm.tag === 'Theorem') {
            expect(thm.axiomBundle.name).toBe('ClassicalMath');
        }
    });
});

// ── Extended parser tests for new constructs ────────────────

describe('parseExpr: math functions', () => {
    it('parses \\sin', () => {
        const t = parseExpr('\\sin');
        expect(t.tag).toBe('Var');
        if (t.tag === 'Var') expect(t.name).toBe('sin');
    });

    it('parses \\cos', () => {
        const t = parseExpr('\\cos');
        expect(t.tag).toBe('Var');
        if (t.tag === 'Var') expect(t.name).toBe('cos');
    });

    it('parses \\log', () => {
        const t = parseExpr('\\log');
        expect(t.tag).toBe('Var');
        if (t.tag === 'Var') expect(t.name).toBe('log');
    });

    it('parses \\det', () => {
        const t = parseExpr('\\det');
        expect(t.tag).toBe('Var');
        if (t.tag === 'Var') expect(t.name).toBe('det');
    });

    it('parses \\gcd', () => {
        const t = parseExpr('\\gcd');
        expect(t.tag).toBe('Var');
        if (t.tag === 'Var') expect(t.name).toBe('gcd');
    });

    it('parses \\max', () => {
        const t = parseExpr('\\max');
        expect(t.tag).toBe('Var');
        if (t.tag === 'Var') expect(t.name).toBe('max');
    });

    it('parses \\min', () => {
        const t = parseExpr('\\min');
        expect(t.tag).toBe('Var');
        if (t.tag === 'Var') expect(t.name).toBe('min');
    });

    it('parses \\exp', () => {
        const t = parseExpr('\\exp');
        expect(t.tag).toBe('Var');
        if (t.tag === 'Var') expect(t.name).toBe('exp');
    });

    it('parses \\ln', () => {
        const t = parseExpr('\\ln');
        expect(t.tag).toBe('Var');
        if (t.tag === 'Var') expect(t.name).toBe('ln');
    });
});

describe('parseExpr: subscripts', () => {
    it('parses a_n as indexed variable', () => {
        const t = parseExpr('a_n');
        expect(t.tag).toBe('App');
    });

    it('parses x_{i+1} as indexed variable with expression subscript', () => {
        const t = parseExpr('x_{i+1}');
        expect(t.tag).toBe('App');
    });
});

describe('parseLatex: proof patterns', () => {
    it('detects "by contradiction" pattern', () => {
        const doc = parseLatex(`\\title{T}
\\begin{theorem}[T]
$1 = 1$
\\end{theorem}
\\begin{proof}
We proceed by contradiction.
\\end{proof}`);
        const thm = doc.nodes.find(n => n.tag === 'ThmNode') as ThmNode;
        expect(thm?.proof).toBeDefined();
        expect(thm?.proof?.tactics.some(t => t.tag === 'Apply')).toBe(true);
    });

    it('detects "WLOG" pattern as LLMSuggest', () => {
        const doc = parseLatex(`\\title{T}
\\begin{theorem}[T]
$1 = 1$
\\end{theorem}
\\begin{proof}
Without loss of generality, assume $x > 0$.
\\end{proof}`);
        const thm = doc.nodes.find(n => n.tag === 'ThmNode') as ThmNode;
        expect(thm?.proof).toBeDefined();
        expect(thm?.proof?.tactics.some(t => t.tag === 'LLMSuggest')).toBe(true);
    });

    it('detects "hence" and "therefore" as simp', () => {
        const doc = parseLatex(`\\title{T}
\\begin{theorem}[T]
$1 = 1$
\\end{theorem}
\\begin{proof}
Hence the result follows.
\\end{proof}`);
        const thm = doc.nodes.find(n => n.tag === 'ThmNode') as ThmNode;
        expect(thm?.proof?.tactics.some(t => t.tag === 'Simp')).toBe(true);
    });

    it('emits LLMSuggest for unrecognized proof text', () => {
        const doc = parseLatex(`\\title{T}
\\begin{theorem}[T]
$1 = 1$
\\end{theorem}
\\begin{proof}
Consider the Cayley-Hamilton theorem applied to the matrix A.
\\end{proof}`);
        const thm = doc.nodes.find(n => n.tag === 'ThmNode') as ThmNode;
        expect(thm?.proof?.tactics.some(t => t.tag === 'LLMSuggest')).toBe(true);
    });
});

describe('parseLatex: math environments', () => {
    it('does not crash on align environment', () => {
        const doc = parseLatex(`\\title{T}
\\begin{theorem}[T]
\\begin{align}
x^2 + y^2 &= z^2 \\\\
x &= 1
\\end{align}
\\end{theorem}`);
        expect(doc.nodes.length).toBeGreaterThan(0);
    });

    it('handles equation* environment', () => {
        const doc = parseLatex(`\\title{T}
\\begin{equation*}
E = mc^2
\\end{equation*}
\\begin{theorem}[T]
$E = mc^2$
\\end{theorem}`);
        expect(doc.nodes.length).toBeGreaterThan(0);
    });
});
