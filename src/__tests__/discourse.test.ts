// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Discourse Analysis Tests
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { analyzeDiscourse, buildDependencyGraph } from '../parser/discourse';
import { parseLatex } from '../parser/latex';

describe('analyzeDiscourse', () => {
    it('extracts theorem blocks', () => {
        const source = `\\begin{theorem}[Pythagorean]
For right triangles, $a^2 + b^2 = c^2$.
\\end{theorem}`;
        const blocks = analyzeDiscourse(source);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].role).toBe('theorem');
        expect(blocks[0].name).toBe('Pythagorean');
    });

    it('extracts definition blocks', () => {
        const source = `\\begin{definition}[Prime]
A number $p > 1$ is prime.
\\end{definition}`;
        const blocks = analyzeDiscourse(source);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].role).toBe('definition');
        expect(blocks[0].name).toBe('Prime');
    });

    it('extracts lemma blocks', () => {
        const source = `\\begin{lemma}[Squares are Non-negative]
$x^2 \\geq 0$ for all $x$.
\\end{lemma}`;
        const blocks = analyzeDiscourse(source);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].role).toBe('lemma');
    });

    it('extracts proof blocks', () => {
        const source = `\\begin{proof}
By induction on $n$.
\\end{proof}`;
        const blocks = analyzeDiscourse(source);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].role).toBe('proof');
    });

    it('extracts multiple blocks from a document', () => {
        const source = `\\begin{definition}[Even]
$n$ is even if $2 | n$.
\\end{definition}

\\begin{theorem}[Sum of Evens]
The sum of two even numbers is even.
\\end{theorem}

\\begin{proof}
Trivial.
\\end{proof}`;
        const blocks = analyzeDiscourse(source);
        expect(blocks).toHaveLength(3);
        expect(blocks.map(b => b.role)).toEqual(['definition', 'theorem', 'proof']);
    });

    it('detects references (\\ref, \\cite)', () => {
        const source = `\\begin{theorem}[Main]
By \\ref{lem:helper} and \\cite{knuth}.
\\end{theorem}`;
        const blocks = analyzeDiscourse(source);
        expect(blocks[0].references).toContain('lem:helper');
        expect(blocks[0].references).toContain('knuth');
    });

    it('falls back to line-based name when no bracket title', () => {
        const source = `\\begin{theorem}
Some theorem.
\\end{theorem}`;
        const blocks = analyzeDiscourse(source);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].name).toMatch(/theorem_\d+/);
    });

    it('handles empty source', () => {
        const blocks = analyzeDiscourse('');
        expect(blocks).toHaveLength(0);
    });

    it('handles corollary and proposition environments', () => {
        const source = `\\begin{corollary}[Cor1]
Result.
\\end{corollary}

\\begin{proposition}[Prop1]
Statement.
\\end{proposition}`;
        const blocks = analyzeDiscourse(source);
        expect(blocks).toHaveLength(2);
        expect(blocks[0].role).toBe('corollary');
        expect(blocks[1].role).toBe('proposition');
    });

    it('handles abbreviated environments (thm, lem, defn)', () => {
        const source = `\\begin{thm}[T1]
Statement.
\\end{thm}

\\begin{lem}[L1]
Lemma.
\\end{lem}

\\begin{defn}[D1]
Definition.
\\end{defn}`;
        const blocks = analyzeDiscourse(source);
        expect(blocks).toHaveLength(3);
        expect(blocks.map(b => b.role)).toEqual(['theorem', 'lemma', 'definition']);
    });
});

describe('buildDependencyGraph', () => {
    it('builds graph from parsed document', () => {
        const source = `\\title{Test}

\\begin{definition}[Prime]
A natural number $p > 1$ is prime.
\\end{definition}

\\begin{theorem}[Fermat]
Let $p$ be a prime number and $a$ an integer.
Then $a^{p-1} \\equiv 1 \\pmod{p}$.
\\end{theorem}`;
        const doc = parseLatex(source);
        const graph = buildDependencyGraph(doc);
        expect(graph.nodes.size).toBeGreaterThanOrEqual(2);
    });
});
