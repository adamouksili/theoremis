// ─────────────────────────────────────────────────────────────
// Tests  ·  API Pipeline
// ─────────────────────────────────────────────────────────────

import { describe, test, expect } from 'vitest';
import {
    apiParse,
    apiEmit,
    apiAnalyze,
    apiFullPipeline,
    apiParseExpr,
} from '../api/pipeline';

const FERMAT_LATEX = `
\\begin{theorem}[Fermat's Last Theorem]
For all integers $n \\geq 3$, there are no positive integers $a$, $b$, $c$ such that $a^n + b^n = c^n$.
\\end{theorem}
`;

const SIMPLE_THEOREM = `
\\begin{theorem}
For all $x \\in \\mathbb{R}$, $x^2 \\geq 0$.
\\end{theorem}
`;

describe('apiParse', () => {
    test('parses LaTeX into document + IR + typecheck', () => {
        const result = apiParse(SIMPLE_THEOREM);
        expect(result.document).toBeDefined();
        expect(result.ir).toBeDefined();
        expect(result.typeCheck).toBeDefined();
        expect(typeof result.elapsed).toBe('number');
        expect(result.elapsed).toBeGreaterThanOrEqual(0);
    });

    test('accepts an axiom bundle name', () => {
        const result = apiParse(SIMPLE_THEOREM, 'NumberTheory');
        expect(result.ir).toBeDefined();
    });

    test('falls back to ClassicalMath for unknown bundle', () => {
        const result = apiParse(SIMPLE_THEOREM, 'NonExistentBundle');
        expect(result.ir).toBeDefined();
    });
});

describe('apiEmit', () => {
    test('emits to all three targets by default', () => {
        const result = apiEmit(SIMPLE_THEOREM);
        expect(result.lean4.code).toBeTruthy();
        expect(result.coq.code).toBeTruthy();
        expect(result.isabelle.code).toBeTruthy();
    });

    test('respects target filter', () => {
        const result = apiEmit(SIMPLE_THEOREM, undefined, ['lean4']);
        expect(result.lean4.code).toBeTruthy();
        expect(result.coq.warnings).toContain('skipped');
        expect(result.isabelle.warnings).toContain('skipped');
    });

    test('lean4 output contains theorem keyword', () => {
        const result = apiEmit(FERMAT_LATEX, undefined, ['lean4']);
        expect(result.lean4.code.toLowerCase()).toContain('theorem');
    });
});

describe('apiAnalyze', () => {
    test('returns theorem analysis with quickcheck', () => {
        const result = apiAnalyze(SIMPLE_THEOREM);
        expect(result.overall).toBeDefined();
        expect(result.overall.totalDeclarations).toBeGreaterThanOrEqual(1);
        expect(result.overall.theoremCount).toBeGreaterThanOrEqual(1);
        expect(result.theorems.length).toBeGreaterThanOrEqual(1);
    });

    test('theorem entry has expected shape', () => {
        const result = apiAnalyze(SIMPLE_THEOREM);
        const thm = result.theorems[0];
        expect(thm).toBeDefined();
        expect(thm.name).toBeDefined();
        expect(thm.tag).toBeDefined();
        expect(thm.statement).toBeDefined();
    });

    test('respects numTests parameter', () => {
        // Just make sure it doesn't throw with a custom count
        const result = apiAnalyze(SIMPLE_THEOREM, undefined, 10);
        expect(result.overall).toBeDefined();
    });
});

describe('apiFullPipeline', () => {
    test('returns parse + emit + analysis', () => {
        const result = apiFullPipeline(SIMPLE_THEOREM);
        expect(result.parse).toBeDefined();
        expect(result.emit).toBeDefined();
        expect(result.analysis).toBeDefined();

        // parse
        expect(result.parse.document).toBeDefined();
        expect(result.parse.ir).toBeDefined();
        expect(typeof result.parse.elapsed).toBe('number');

        // emit
        expect(result.emit.lean4.code).toBeTruthy();
        expect(result.emit.coq.code).toBeTruthy();

        // analysis
        expect(result.analysis.overall.totalDeclarations).toBeGreaterThanOrEqual(1);
    });
});

describe('apiParseExpr', () => {
    test('parses a single expression', () => {
        const result = apiParseExpr('x^2 + y^2');
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
    });

    test('parses a fraction', () => {
        const result = apiParseExpr('\\frac{a}{b}');
        expect(result).toBeDefined();
    });
});
