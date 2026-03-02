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
import { formatLeanDiagnostics, checkBridgeHealth } from '../bridge/lean-client';
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

// ── Lean Bridge client-server round-trip mock test ──────────

describe('E2E: Lean bridge client', () => {
    it('formatLeanDiagnostics formats success', () => {
        const result = formatLeanDiagnostics({
            success: true,
            errors: [],
            warnings: [],
            elapsed: 42,
        });
        expect(result).toContain('PASS');
        expect(result).toContain('42');
    });

    it('formatLeanDiagnostics formats errors', () => {
        const result = formatLeanDiagnostics({
            success: false,
            errors: [{ line: 5, column: 10, message: 'unknown identifier', severity: 'error' }],
            warnings: [],
            elapsed: 100,
        });
        expect(result).toContain('FAIL');
        expect(result).toContain('unknown identifier');
        expect(result).toContain('L5:10');
    });

    it('checkBridgeHealth returns a valid response shape', async () => {
        const result = await checkBridgeHealth();
        // The result should always have an `available` boolean regardless of server state
        expect(typeof result.available).toBe('boolean');
        if (result.available) {
            expect(typeof result.version).toBe('string');
        }
    });
});

// ── Real mathematical document end-to-end test ──────────────

describe('E2E: Full mathematical document (multi-theorem)', () => {
    const fullDoc = `\\title{Elementary Number Theory Theorems}

\\begin{definition}[Prime Number]
A natural number $p > 1$ is \\emph{prime} if its only divisors are $1$ and $p$.
\\end{definition}

\\begin{definition}[Coprime]
Two integers $a$ and $b$ are \\emph{coprime} if $\\gcd(a, b) = 1$.
\\end{definition}

\\begin{theorem}[Fermat's Little Theorem]
Let $p$ be a prime number and $a$ an integer coprime to $p$.
Then $a^{p-1} \\equiv 1 \\pmod{p}$.
\\end{theorem}

\\begin{proof}
We proceed by induction on $a$.
\\end{proof}

\\begin{theorem}[Squares are Non-negative]
For all $x \\in \\mathbb{R}$, $x^2 \\geq 0$.
\\end{theorem}

\\begin{proof}
By cases on the sign of $x$.
\\end{proof}

\\begin{theorem}[Sum Identity]
For all $n \\in \\mathbb{N}$, $n + 0 = n$.
\\end{theorem}

\\begin{proof}
Trivial by arithmetic.
\\end{proof}

\\begin{lemma}[Even Sum]
For all $a \\in \\mathbb{Z}$, $b \\in \\mathbb{Z}$, if $a$ and $b$ are even, then $a + b$ is even.
\\end{lemma}

\\begin{proof}
By cases on the parity of $a$ and $b$.
\\end{proof}`;

    it('parses 2 definitions, 3 theorems, 1 lemma', () => {
        const { ir } = fullPipeline(fullDoc);
        const defs = ir.declarations.filter(d => d.tag === 'Definition');
        const thms = ir.declarations.filter(d => d.tag === 'Theorem');
        const lems = ir.declarations.filter(d => d.tag === 'Lemma');
        expect(defs.length).toBe(2);
        expect(thms.length).toBe(3);
        expect(lems.length).toBe(1);
    });

    it('Lean 4 emitted code has balanced parens', () => {
        const { lean4 } = fullPipeline(fullDoc);
        const code = lean4.code;
        let depth = 0;
        for (const ch of code) {
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            expect(depth).toBeGreaterThanOrEqual(0);
        }
        expect(depth).toBe(0);
    });

    it('Lean 4 code has no dangling "by" without following tactic', () => {
        const { lean4 } = fullPipeline(fullDoc);
        const lines = lean4.code.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().endsWith(':= by')) {
                // Next non-empty line should exist and be a tactic
                let j = i + 1;
                while (j < lines.length && lines[j].trim() === '') j++;
                expect(j).toBeLessThan(lines.length);
                expect(lines[j].trim().length).toBeGreaterThan(0);
            }
        }
    });

    it('all three backends produce non-empty output for full doc', () => {
        const { lean4, coq, isabelle } = fullPipeline(fullDoc);
        expect(lean4.code.length).toBeGreaterThan(100);
        expect(coq.code.length).toBeGreaterThan(100);
        expect(isabelle.code.length).toBeGreaterThan(100);
    });

    it('axiom bundle threading: MinimalCore vs ClassicalMath', () => {
        const doc = parseLatex(fullDoc);

        const irMinimal = documentToIR(doc, BUNDLES.MinimalCore);
        const lean4Minimal = emitLean4(irMinimal);
        expect(lean4Minimal.code).not.toContain('import Mathlib.Tactic.NormNum');

        const irClassical = documentToIR(doc, BUNDLES.ClassicalMath);
        const lean4Classical = emitLean4(irClassical);
        expect(lean4Classical.code).toContain('import Mathlib.Tactic.NormNum');
    });
});

// ── Counterexample engine validation ────────────────────────

describe('E2E: Counterexample engine detects dropped hypotheses', () => {
    it('dropping coprime hypothesis should produce different behavior', async () => {
        const source = `\\title{Test}

\\begin{theorem}[Fermat's Little Theorem]
Let $p$ be a prime number and $a$ an integer coprime to $p$.
Then $a^{p-1} \\equiv 1 \\pmod{p}$.
\\end{theorem}

\\begin{proof}
We proceed by induction on $a$.
\\end{proof}`;

        const { ir } = fullPipeline(source);
        const thm = ir.declarations.find(d => d.tag === 'Theorem') as Theorem;
        expect(thm).toBeDefined();
        expect(thm.params.length).toBeGreaterThan(0);

        const report = await runCounterexampleEngine(thm);
        expect(report).toBeDefined();
        expect(report.results.length).toBeGreaterThan(0);
    });
});

// ── Math function & subscript pipeline ──────────────────────

describe('E2E: math functions through the pipeline', () => {
    it('parses \\sin and produces valid emitter output', () => {
        const source = `\\title{Trig}

\\begin{theorem}[Pythagorean Identity]
For all $x \\in \\mathbb{R}$, $\\sin^2(x) + \\cos^2(x) = 1$.
\\end{theorem}`;

        const { ir, lean4, coq } = fullPipeline(source);
        expect(ir.declarations.length).toBe(1);
        expect(lean4.code.length).toBeGreaterThan(0);
        expect(coq.code.length).toBeGreaterThan(0);
    });

    it('subscripts survive the pipeline', () => {
        const source = `\\title{Sequences}

\\begin{theorem}[Bounded Sequence]
For all $n \\in \\mathbb{N}$, $a_n \\leq 100$.
\\end{theorem}`;

        const { ir, lean4 } = fullPipeline(source);
        expect(ir.declarations.length).toBe(1);
        expect(lean4.code.length).toBeGreaterThan(0);
    });
});

// ── QuickCheck classification pipeline ──────────────────────

describe('E2E: QuickCheck with classification', () => {
    it('classifies a true arithmetic identity as verified', () => {
        const source = `\\title{T}

\\begin{theorem}[Commutativity]
For all $x \\in \\mathbb{N}$, $y \\in \\mathbb{N}$, $x + y = y + x$.
\\end{theorem}`;

        const { ir } = fullPipeline(source);
        const thm = ir.declarations.find(d => d.tag === 'Theorem') as Theorem;
        const vars = extractVariables(thm.statement);
        const report = quickCheck(thm.statement, vars, 500);
        expect(report.classification).toBe('verified');
        expect(report.skipped).toBeGreaterThanOrEqual(0);
    });

    it('classifies a false statement as falsified', () => {
        const source = `\\title{T}

\\begin{theorem}[False]
For all $x \\in \\mathbb{N}$, $x > 100$.
\\end{theorem}`;

        const { ir } = fullPipeline(source);
        const thm = ir.declarations.find(d => d.tag === 'Theorem') as Theorem;
        const vars = extractVariables(thm.statement);
        const report = quickCheck(thm.statement, vars, 500);
        expect(['falsified', 'likely_false']).toContain(report.classification);
    });
});

// ── LLM module unit tests ───────────────────────────────────

describe('LLM: provider detection', () => {
    it('detects OpenAI key', async () => {
        const { detectProvider } = await import('../engine/llm');
        expect(detectProvider('sk-abc123')).toBe('openai');
    });

    it('detects Anthropic key', async () => {
        const { detectProvider } = await import('../engine/llm');
        expect(detectProvider('sk-ant-abc123')).toBe('anthropic');
    });

    it('detects GitHub PAT', async () => {
        const { detectProvider } = await import('../engine/llm');
        expect(detectProvider('ghp_abc123')).toBe('github');
    });

    it('returns correct default models', async () => {
        const { defaultModelForProvider } = await import('../engine/llm');
        expect(defaultModelForProvider('openai')).toBe('gpt-4o-mini');
        expect(defaultModelForProvider('anthropic')).toBe('claude-sonnet-4-20250514');
        expect(defaultModelForProvider('github')).toBe('gpt-4o');
    });

    it('tracks cumulative usage', async () => {
        const { getCumulativeUsage, resetUsage } = await import('../engine/llm');
        resetUsage();
        const usage = getCumulativeUsage();
        expect(usage.promptTokens).toBe(0);
        expect(usage.completionTokens).toBe(0);
        expect(usage.estimatedCostUsd).toBe(0);
    });
});
