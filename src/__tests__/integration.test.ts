// ─────────────────────────────────────────────────────────────
// Theoremis  ·  End-to-End Integration Tests
// Full pipeline: LaTeX → IR → TypeCheck → Emit → Verify
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { parseLatex, documentToIR } from '../parser/latex';
import { typeCheck } from '../core/typechecker';
import { emitLean4 } from '../emitters/lean4';
import { emitCoq } from '../emitters/coq';
import { emitIsabelle } from '../emitters/isabelle';
import { runCounterexampleEngine } from '../engine/counterexample';
import { quickCheck, extractVariables } from '../engine/evaluator';
import { BUNDLES, type Theorem } from '../core/ir';

// ── Helpers ─────────────────────────────────────────────────

function fullPipeline(latex: string) {
    const doc = parseLatex(latex);
    const ir = documentToIR(doc);
    const tc = typeCheck(ir);
    const lean4 = emitLean4(ir);
    const coq = emitCoq(ir);
    const isabelle = emitIsabelle(ir);
    return { doc, ir, tc, lean4, coq, isabelle };
}

// ── Golden integration tests ────────────────────────────────

describe('E2E: Fermat\'s Little Theorem', () => {
    const source = `\\title{Number Theory}

\\begin{theorem}[Fermat's Little Theorem]
Let $p$ be a prime number and $a$ an integer coprime to $p$.
Then $a^{p-1} \\equiv 1 \\pmod{p}$.
\\end{theorem}

\\begin{proof}
We proceed by induction on $a$.
\\end{proof}`;

    it('parses to a valid document', () => {
        const { doc } = fullPipeline(source);
        expect(doc.nodes.length).toBeGreaterThan(0);
    });

    it('produces IR with theorem declaration', () => {
        const { ir } = fullPipeline(source);
        expect(ir.declarations.length).toBeGreaterThan(0);
        const thm = ir.declarations.find(d => d.tag === 'Theorem');
        expect(thm).toBeDefined();
    });

    it('type-checks without fatal errors', () => {
        const { tc } = fullPipeline(source);
        expect(tc).toBeDefined();
        // May have holes/warnings, but should not crash
    });

    it('emits valid Lean 4 code', () => {
        const { lean4 } = fullPipeline(source);
        expect(lean4.language).toBe('lean4');
        expect(lean4.code).toContain('theorem');
        expect(lean4.code.length).toBeGreaterThan(10);
    });

    it('emits valid Coq code', () => {
        const { coq } = fullPipeline(source);
        expect(coq.language).toBe('coq');
        expect(coq.code).toContain('Theorem');
    });

    it('emits valid Isabelle code', () => {
        const { isabelle } = fullPipeline(source);
        expect(isabelle.language).toBe('isabelle');
        expect(isabelle.code).toContain('theorem');
    });
});

describe('E2E: Definition + Theorem + Proof', () => {
    const source = `\\title{Basics}

\\begin{definition}[Prime Number]
A natural number $p > 1$ is \\emph{prime} if its only divisors are $1$ and $p$.
\\end{definition}

\\begin{theorem}[Squares are Non-negative]
For all $x \\in \\mathbb{R}$, $x^2 \\geq 0$.
\\end{theorem}

\\begin{proof}
By cases on the sign of $x$.
\\end{proof}`;

    it('produces both definition and theorem', () => {
        const { ir } = fullPipeline(source);
        const def = ir.declarations.find(d => d.tag === 'Definition');
        const thm = ir.declarations.find(d => d.tag === 'Theorem');
        expect(def).toBeDefined();
        expect(thm).toBeDefined();
    });

    it('Lean 4 output contains both def and theorem', () => {
        const { lean4 } = fullPipeline(source);
        expect(lean4.code).toContain('def');
        expect(lean4.code).toContain('theorem');
    });

    it('all three backends produce non-empty output', () => {
        const { lean4, coq, isabelle } = fullPipeline(source);
        expect(lean4.code.length).toBeGreaterThan(0);
        expect(coq.code.length).toBeGreaterThan(0);
        expect(isabelle.code.length).toBeGreaterThan(0);
    });
});

describe('E2E: Counterexample engine', () => {
    it('runs counterexample engine on a theorem', async () => {
        const source = `\\title{Test}

\\begin{theorem}[Trivial]
For all $x \\in \\mathbb{R}$, $x^2 \\geq 0$.
\\end{theorem}

\\begin{proof}
Trivial.
\\end{proof}`;

        const { ir } = fullPipeline(source);
        const thm = ir.declarations.find(d => d.tag === 'Theorem') as Theorem;
        expect(thm).toBeDefined();

        const report = await runCounterexampleEngine(thm);
        expect(report).toBeDefined();
        expect(report.results).toBeDefined();
        expect(Array.isArray(report.results)).toBe(true);
    });
});

describe('E2E: QuickCheck random testing', () => {
    it('runs QuickCheck on extracted variables', () => {
        const source = `\\title{Test}

\\begin{theorem}[NonNeg]
For all $x \\in \\mathbb{R}$, $x^2 \\geq 0$.
\\end{theorem}

\\begin{proof}
By cases.
\\end{proof}`;

        const { ir } = fullPipeline(source);
        const thm = ir.declarations.find(d => d.tag === 'Theorem') as Theorem;
        expect(thm).toBeDefined();

        const vars = extractVariables(thm.statement);
        if (vars.length > 0) {
            const report = quickCheck(thm.statement, vars, 100);
            expect(report).toBeDefined();
            expect(report.totalTests).toBeGreaterThan(0);
        }
    });
});

describe('E2E: Axiom bundle threading', () => {
    it('threads axiom bundle to IR declarations', () => {
        const source = `\\title{Test}

\\begin{theorem}[Test]
For all $n \\in \\mathbb{N}$, $n + 0 = n$.
\\end{theorem}

\\begin{proof}
Trivial.
\\end{proof}`;

        const doc = parseLatex(source);
        const ir = documentToIR(doc, BUNDLES.MinimalCore);
        const thm = ir.declarations.find(d => d.tag === 'Theorem') as Theorem;
        expect(thm).toBeDefined();
        // MinimalCore bundle has no axioms at all
        expect(thm.axiomBundle.axioms.size).toBe(0);
    });

    it('ClassicalMath bundle includes LEM and Choice', () => {
        const source = `\\title{Test}

\\begin{theorem}[Test]
$p > 0$.
\\end{theorem}

\\begin{proof}
Obvious.
\\end{proof}`;

        const doc = parseLatex(source);
        const ir = documentToIR(doc, BUNDLES.ClassicalMath);
        const thm = ir.declarations.find(d => d.tag === 'Theorem') as Theorem;
        expect(thm).toBeDefined();
        expect(thm.axiomBundle.axioms.has('LEM')).toBe(true);
        expect(thm.axiomBundle.axioms.has('Choice')).toBe(true);
    });
});

describe('E2E: Lemma handling', () => {
    const source = `\\title{Test}

\\begin{lemma}[Helper]
For all $x \\in \\mathbb{R}$, $x^2 \\geq 0$.
\\end{lemma}

\\begin{proof}
By cases on the sign of $x$.
\\end{proof}`;

    it('parses lemma to IR', () => {
        const { ir } = fullPipeline(source);
        const lem = ir.declarations.find(d => d.tag === 'Lemma');
        expect(lem).toBeDefined();
    });

    it('emits lemma in all backends', () => {
        const { lean4, coq, isabelle } = fullPipeline(source);
        expect(lean4.code).toContain('lemma');
        expect(coq.code).toContain('Lemma');
        expect(isabelle.code).toContain('lemma');
    });
});

describe('E2E: Empty / minimal documents', () => {
    it('handles document with only title', () => {
        const { ir } = fullPipeline('\\title{Empty}');
        expect(ir.declarations).toHaveLength(0);
    });

    it('handles document with only definitions', () => {
        const source = `\\title{Defs}

\\begin{definition}[Double]
Let $f(n) = 2n$.
\\end{definition}`;
        const { ir, lean4 } = fullPipeline(source);
        expect(ir.declarations.length).toBeGreaterThan(0);
        expect(lean4.code.length).toBeGreaterThan(0);
    });
});
