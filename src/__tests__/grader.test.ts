// ─────────────────────────────────────────────────────────────
// Tests  ·  Grader Engine
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { gradeSubmission } from '../api/grader';
import type { GradeRubric } from '../api/grader';

// ── Helpers ─────────────────────────────────────────────────

const VALID_THEOREM = String.raw`
\begin{theorem}[Non-negative square]
For all $x \in \mathbb{R}$, $x^2 \geq 0$.
\end{theorem}
`;

const TWO_THEOREMS = String.raw`
\begin{theorem}[Square non-neg]
For all $x \in \mathbb{R}$, $x^2 \geq 0$.
\end{theorem}

\begin{lemma}[Sum comm]
For all $a, b \in \mathbb{R}$, $a + b = b + a$.
\end{lemma}
`;

const BAD_LATEX = 'This is not a valid theorem block at all.';

// ── Basic grading ───────────────────────────────────────────

describe('gradeSubmission', () => {
    it('should return a complete GradeReport', () => {
        const report = gradeSubmission(VALID_THEOREM);
        expect(report).toHaveProperty('totalPoints');
        expect(report).toHaveProperty('maxPoints');
        expect(report).toHaveProperty('percentage');
        expect(report).toHaveProperty('letterGrade');
        expect(report).toHaveProperty('theorems');
        expect(report).toHaveProperty('breakdown');
        expect(report).toHaveProperty('overallFeedback');
        expect(report).toHaveProperty('diagnostics');
        expect(report).toHaveProperty('submissionTime');
        expect(report).toHaveProperty('elapsed');
    });

    it('should assign a letter grade', () => {
        const report = gradeSubmission(VALID_THEOREM);
        expect(['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F']).toContain(report.letterGrade);
    });

    it('should have breakdown with all five categories', () => {
        const report = gradeSubmission(VALID_THEOREM);
        expect(report.breakdown).toHaveProperty('parsing');
        expect(report.breakdown).toHaveProperty('typeCheck');
        expect(report.breakdown).toHaveProperty('quickCheck');
        expect(report.breakdown).toHaveProperty('emission');
        expect(report.breakdown).toHaveProperty('structure');
    });

    it('should record elapsed time', () => {
        const report = gradeSubmission(VALID_THEOREM);
        expect(report.elapsed).toBeGreaterThanOrEqual(0);
    });

    it('should propagate studentId', () => {
        const report = gradeSubmission(VALID_THEOREM, {}, 'student_42');
        expect(report.studentId).toBe('student_42');
    });
});

// ── Parsing credit ──────────────────────────────────────────

describe('gradeSubmission – parsing', () => {
    it('should give full parse credit for valid LaTeX', () => {
        const report = gradeSubmission(VALID_THEOREM);
        expect(report.breakdown.parsing.earned).toBe(report.breakdown.parsing.possible);
    });

    it('should give zero parse credit for empty/plain text', () => {
        const report = gradeSubmission(BAD_LATEX);
        expect(report.breakdown.parsing.earned).toBe(0);
    });

    it('should give partial parse credit when fewer declarations than required', () => {
        const rubric: GradeRubric = { minDeclarations: 3 };
        const report = gradeSubmission(VALID_THEOREM, rubric);
        expect(report.breakdown.parsing.earned).toBeGreaterThan(0);
        expect(report.breakdown.parsing.earned).toBeLessThan(report.breakdown.parsing.possible);
    });
});

// ── Type-check credit ───────────────────────────────────────

describe('gradeSubmission – type-check', () => {
    it('should earn type-check points on a well-formed theorem', () => {
        const report = gradeSubmission(VALID_THEOREM);
        expect(report.breakdown.typeCheck.earned).toBeGreaterThan(0);
    });
});

// ── QuickCheck credit ───────────────────────────────────────

describe('gradeSubmission – quickCheck', () => {
    it('should produce theorem grades', () => {
        const report = gradeSubmission(VALID_THEOREM);
        expect(report.theorems.length).toBeGreaterThanOrEqual(1);
    });

    it('should mark x² ≥ 0 as passing QuickCheck', () => {
        const report = gradeSubmission(VALID_THEOREM);
        const thm = report.theorems.find(t => t.quickCheckResult !== null);
        if (thm) {
            expect(thm.quickCheckPassed).toBe(true);
        }
    });

    it('should grade multiple theorems independently', () => {
        const report = gradeSubmission(TWO_THEOREMS);
        expect(report.theorems.length).toBeGreaterThanOrEqual(2);
    });
});

// ── Emission credit ─────────────────────────────────────────

describe('gradeSubmission – emission', () => {
    it('should give full emission points when not required', () => {
        const report = gradeSubmission(VALID_THEOREM, { requireCleanEmission: false });
        expect(report.breakdown.emission.earned).toBe(report.breakdown.emission.possible);
    });

    it('should attempt emission check when required', () => {
        const report = gradeSubmission(VALID_THEOREM, { requireCleanEmission: true });
        // Should get some points (may or may not be full)
        expect(report.breakdown.emission.earned).toBeGreaterThanOrEqual(0);
        expect(report.breakdown.emission.detail).not.toBe('Skipped (parse failed)');
    });
});

// ── Structure / reference solution ──────────────────────────

describe('gradeSubmission – structure', () => {
    it('should give full structure points when no reference is given', () => {
        const report = gradeSubmission(VALID_THEOREM);
        expect(report.breakdown.structure.earned).toBe(report.breakdown.structure.possible);
    });

    it('should compare against reference solution when provided', () => {
        const rubric: GradeRubric = { referenceSolution: VALID_THEOREM };
        const report = gradeSubmission(VALID_THEOREM, rubric);
        expect(report.breakdown.structure.earned).toBeGreaterThan(0);
        expect(report.breakdown.structure.detail).toContain('match reference');
    });

    it('should lose structure points when submission differs from reference', () => {
        const rubric: GradeRubric = { referenceSolution: TWO_THEOREMS };
        const report = gradeSubmission(VALID_THEOREM, rubric);
        // 1 of 2 declarations matched → partial credit
        expect(report.breakdown.structure.earned).toBeLessThan(report.breakdown.structure.possible);
    });
});

// ── Expected theorems / rubric ──────────────────────────────

describe('gradeSubmission – expected theorems', () => {
    it('should flag missing expected theorems', () => {
        const rubric: GradeRubric = { expectedTheorems: ['fermat_little_theorem'] };
        const report = gradeSubmission(VALID_THEOREM, rubric);
        const missing = report.theorems.find(t => t.name === 'fermat_little_theorem');
        expect(missing).toBeDefined();
        expect(missing!.found).toBe(false);
        expect(missing!.pointsEarned).toBe(0);
    });

    it('should use fuzzy matching for expected theorem names', () => {
        const rubric: GradeRubric = { expectedTheorems: ['non-negative'] };
        const report = gradeSubmission(VALID_THEOREM, rubric);
        // The theorem "Non-negative square" should fuzzy match "non-negative"
        const thm = report.theorems.find(t => t.name.toLowerCase().includes('non'));
        if (thm) {
            expect(thm.found).toBe(true);
        }
    });
});

// ── Rubric custom points ────────────────────────────────────

describe('gradeSubmission – custom rubric', () => {
    it('should respect maxPoints', () => {
        const rubric: GradeRubric = { maxPoints: 50 };
        const report = gradeSubmission(VALID_THEOREM, rubric);
        expect(report.maxPoints).toBe(50);
        expect(report.totalPoints).toBeLessThanOrEqual(50);
    });

    it('should respect custom point allocations', () => {
        const rubric: GradeRubric = {
            points: { parsing: 10, typeCheck: 10, quickCheck: 50, emission: 10, structure: 20 },
        };
        const report = gradeSubmission(VALID_THEOREM, rubric);
        expect(report.breakdown.parsing.possible).toBe(10);
        expect(report.breakdown.typeCheck.possible).toBe(10);
        expect(report.breakdown.quickCheck.possible).toBe(50);
    });

    it('should use the requested axiom bundle', () => {
        const rubric: GradeRubric = { axiomBundle: 'NumberTheory' };
        const report = gradeSubmission(VALID_THEOREM, rubric);
        // Should still grade (NumberTheory is a valid bundle)
        expect(report.totalPoints).toBeGreaterThan(0);
    });

    it('should fall back to ClassicalMath for unknown bundles', () => {
        const rubric: GradeRubric = { axiomBundle: 'FakeBundle' };
        const report = gradeSubmission(VALID_THEOREM, rubric);
        expect(report.totalPoints).toBeGreaterThan(0);
    });
});

// ── Edge cases ──────────────────────────────────────────────

describe('gradeSubmission – edge cases', () => {
    it('should handle empty string', () => {
        const report = gradeSubmission('');
        expect(report.percentage).toBeDefined();
        expect(report.letterGrade).toBeDefined();
    });

    it('should handle a submission that only has definitions', () => {
        const latex = String.raw`
\begin{definition}[Natural]
Let $\mathbb{N}$ denote the set of natural numbers.
\end{definition}
`;
        const report = gradeSubmission(latex);
        expect(report.breakdown.parsing.earned).toBeGreaterThanOrEqual(0);
    });

    it('should complete grading in under 5 seconds', () => {
        const report = gradeSubmission(VALID_THEOREM, { numTests: 100 });
        expect(report.elapsed).toBeLessThan(5000);
    });
});

// ── Grade scale ─────────────────────────────────────────────

describe('gradeSubmission – letter grade scale', () => {
    it('should assign A-range for high-quality proofs', () => {
        const report = gradeSubmission(VALID_THEOREM);
        if (report.percentage >= 90) {
            expect(['A', 'A-']).toContain(report.letterGrade);
        }
    });

    it('should never return an invalid letter grade', () => {
        const validGrades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'];
        for (const latex of [VALID_THEOREM, TWO_THEOREMS, BAD_LATEX, '']) {
            const report = gradeSubmission(latex);
            expect(validGrades).toContain(report.letterGrade);
        }
    });
});
