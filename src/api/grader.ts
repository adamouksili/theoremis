// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Grader Engine
// Auto-grades LaTeX math submissions against a rubric
// ─────────────────────────────────────────────────────────────

import { parseLatex, documentToIR } from '../parser/latex';
import { typeCheck, type TypeCheckMode } from '../core/typechecker';
import { emitLean4 } from '../emitters/lean4';
import { quickCheck, extractVariables } from '../engine/evaluator';
import { BUNDLES } from '../core/ir';
import type { AxiomBundle, IRModule, Theorem } from '../core/ir';
import { prettyTerm } from '../core/pretty';
import { serializeTestReport } from './serialize';

// ── Types ───────────────────────────────────────────────────

export interface GradeRubric {
    /** Expected theorem names or patterns */
    expectedTheorems?: string[];
    /** Minimum declarations required */
    minDeclarations?: number;
    /** Required axiom bundle */
    axiomBundle?: string;
    /** Whether type-check must pass */
    requireTypeCheck?: boolean;
    /** Number of QuickCheck tests */
    numTests?: number;
    /** Type-check semantics mode */
    typeCheckMode?: TypeCheckMode;
    /** Whether emitted Lean 4 must have no warnings */
    requireCleanEmission?: boolean;
    /** Custom point allocations */
    points?: {
        parsing?: number;
        typeCheck?: number;
        quickCheck?: number;
        emission?: number;
        structure?: number;
    };
    /** Maximum total points */
    maxPoints?: number;
    /** Reference solution LaTeX (for structural comparison) */
    referenceSolution?: string;
}

export interface TheoremGrade {
    name: string;
    tag: string;
    found: boolean;
    typeCheckPassed: boolean;
    quickCheckResult: Record<string, unknown> | null;
    quickCheckPassed: boolean;
    emissionClean: boolean;
    structureMatch: boolean;
    feedback: string[];
    pointsEarned: number;
    pointsPossible: number;
}

export interface GradeReport {
    studentId?: string;
    submissionTime: string;
    totalPoints: number;
    maxPoints: number;
    percentage: number;
    letterGrade: string;
    theorems: TheoremGrade[];
    overallFeedback: string[];
    breakdown: {
        parsing: { earned: number; possible: number; detail: string };
        typeCheck: { earned: number; possible: number; detail: string };
        quickCheck: { earned: number; possible: number; detail: string };
        emission: { earned: number; possible: number; detail: string };
        structure: { earned: number; possible: number; detail: string };
    };
    diagnostics: Array<{ severity: string; message: string }>;
    elapsed: number;
}

// ── Default points ──────────────────────────────────────────

const DEFAULT_POINTS = {
    parsing: 20,
    typeCheck: 25,
    quickCheck: 25,
    emission: 15,
    structure: 15,
};

// ── Grade a submission ──────────────────────────────────────

export function gradeSubmission(
    latex: string,
    rubric: GradeRubric = {},
    studentId?: string,
): GradeReport {
    const start = performance.now();
    const pts = { ...DEFAULT_POINTS, ...rubric.points };
    const maxPoints = rubric.maxPoints ?? Object.values(pts).reduce((a, b) => a + b, 0);
    const bundleName = rubric.axiomBundle ?? 'ClassicalMath';
    const bundle: AxiomBundle = BUNDLES[bundleName] ?? BUNDLES.ClassicalMath;
    const numTests = rubric.numTests ?? 500;
    const typeCheckMode: TypeCheckMode = rubric.typeCheckMode ?? 'permissive';

    const overallFeedback: string[] = [];
    const diagnostics: Array<{ severity: string; message: string }> = [];

    let parseEarned = 0;
    let parseDetail = '';
    let tcEarned = 0;
    let tcDetail = '';
    let qcEarned = 0;
    let qcDetail = '';
    let emitEarned = 0;
    let emitDetail = '';
    let structEarned = 0;
    let structDetail = '';

    let ir: IRModule | null = null;
    let tcValid = false;

    // ── 1. Parse ────────────────────────────────────────────

    try {
        const doc = parseLatex(latex);
        ir = documentToIR(doc, bundle);

        if (ir.declarations.length === 0) {
            parseDetail = 'No declarations found in document';
            overallFeedback.push('Your submission did not contain any recognizable theorem/definition environments.');
        } else {
            const minDecl = rubric.minDeclarations ?? 1;
            if (ir.declarations.length >= minDecl) {
                parseEarned = pts.parsing;
                parseDetail = `${ir.declarations.length} declarations parsed successfully`;
            } else {
                parseEarned = Math.round(pts.parsing * (ir.declarations.length / minDecl));
                parseDetail = `Found ${ir.declarations.length}/${minDecl} expected declarations`;
                overallFeedback.push(`Expected at least ${minDecl} declarations, found ${ir.declarations.length}.`);
            }
        }
    } catch (err) {
        parseDetail = `Parse error: ${err instanceof Error ? err.message : String(err)}`;
        overallFeedback.push('Your LaTeX could not be parsed. Please check your \\begin{theorem}...\\end{theorem} environments.');
        diagnostics.push({ severity: 'error', message: parseDetail });
    }

    // ── 2. Type-check ───────────────────────────────────────

    if (ir) {
        try {
            const tc = typeCheck(ir, { mode: typeCheckMode });
            tcValid = tc.valid;

            for (const d of tc.diagnostics) {
                diagnostics.push({ severity: d.severity, message: d.message });
            }

            if (tc.valid) {
                tcEarned = pts.typeCheck;
                tcDetail = 'Type-check passed with no errors';
            } else {
                const errorCount = tc.diagnostics.filter(d => d.severity === 'error').length;
                const warnCount = tc.diagnostics.filter(d => d.severity === 'warning').length;
                // Partial credit: lose points per error
                tcEarned = Math.max(0, pts.typeCheck - (errorCount * 5) - (warnCount * 2));
                tcDetail = `${errorCount} errors, ${warnCount} warnings`;
                overallFeedback.push(`Type-checking found ${errorCount} error(s). Review your variable types and quantifier domains.`);
            }
        } catch (err) {
            tcDetail = `Type-checker crashed: ${err instanceof Error ? err.message : String(err)}`;
            diagnostics.push({ severity: 'error', message: tcDetail });
        }
    } else {
        tcDetail = 'Skipped (parse failed)';
    }

    // ── 3. QuickCheck each theorem ──────────────────────────

    const theoremGrades: TheoremGrade[] = [];
    const expectedNames = new Set(rubric.expectedTheorems ?? []);

    if (ir) {
        let totalThmPoints = 0;
        let earnedThmPoints = 0;
        const thmDecls = ir.declarations.filter(
            (d): d is Theorem => d.tag === 'Theorem' || d.tag === 'Lemma'
        );

        for (const decl of thmDecls) {
            const pointsPerThm = thmDecls.length > 0 ? pts.quickCheck / thmDecls.length : 0;
            totalThmPoints += pointsPerThm;

            const found = expectedNames.size === 0 || expectedNames.has(decl.name) || hasNameMatch(decl.name, expectedNames);
            const vars = extractVariables(decl.statement);
            let qcResult: Record<string, unknown> | null = null;
            let qcPassed = true;

            if (vars.length > 0) {
                const report = quickCheck(decl.statement, vars, numTests, decl.params);
                qcResult = serializeTestReport(report);
                qcPassed = report.failed === 0;
            }

            const feedback: string[] = [];
            let thmPoints = 0;

            if (!found && expectedNames.size > 0) {
                feedback.push(`Unexpected theorem name "${decl.name}". Expected one of: ${Array.from(expectedNames).join(', ')}`);
            }

            if (qcPassed) {
                thmPoints = pointsPerThm;
                feedback.push(`All ${numTests} random tests passed ✓`);
            } else {
                const failed = (qcResult?.failed as number) ?? 0;
                thmPoints = Math.max(0, pointsPerThm * (1 - failed / numTests));
                feedback.push(`${failed}/${numTests} random tests failed — your statement may have a bug`);
            }

            earnedThmPoints += thmPoints;

            theoremGrades.push({
                name: decl.name,
                tag: decl.tag,
                found,
                typeCheckPassed: tcValid,
                quickCheckResult: qcResult,
                quickCheckPassed: qcPassed,
                emissionClean: true, // filled in next step
                structureMatch: true, // filled in structure step
                feedback,
                pointsEarned: Math.round(thmPoints * 10) / 10,
                pointsPossible: Math.round(pointsPerThm * 10) / 10,
            });
        }

        // Check for missing expected theorems
        if (expectedNames.size > 0) {
            const foundNames = new Set(thmDecls.map(d => d.name));
            for (const expected of expectedNames) {
                if (!foundNames.has(expected) && !thmDecls.some(d => hasNameMatch(d.name, new Set([expected])))) {
                    theoremGrades.push({
                        name: expected,
                        tag: 'Theorem',
                        found: false,
                        typeCheckPassed: false,
                        quickCheckResult: null,
                        quickCheckPassed: false,
                        emissionClean: false,
                        structureMatch: false,
                        feedback: [`Missing theorem: "${expected}" was not found in submission`],
                        pointsEarned: 0,
                        pointsPossible: Math.round((pts.quickCheck / expectedNames.size) * 10) / 10,
                    });
                    overallFeedback.push(`Missing expected theorem: "${expected}"`);
                }
            }
        }

        qcEarned = Math.round(earnedThmPoints * 10) / 10;
        qcDetail = `${theoremGrades.filter(t => t.quickCheckPassed).length}/${theoremGrades.length} theorems passed QuickCheck`;
    } else {
        qcDetail = 'Skipped (parse failed)';
    }

    // ── 4. Emission check ───────────────────────────────────

    if (ir && (rubric.requireCleanEmission ?? false)) {
        try {
            const lean4 = emitLean4(ir);
            if (lean4.warnings.length === 0) {
                emitEarned = pts.emission;
                emitDetail = 'Clean Lean 4 emission with no warnings';
            } else {
                emitEarned = Math.max(0, pts.emission - lean4.warnings.length * 3);
                emitDetail = `${lean4.warnings.length} emission warnings`;
                for (const tg of theoremGrades) tg.emissionClean = false;
            }
        } catch (err) {
            emitDetail = `Emission failed: ${err instanceof Error ? err.message : String(err)}`;
        }
    } else if (ir) {
        // Emission not required, give full points
        emitEarned = pts.emission;
        emitDetail = 'Emission check not required';
    } else {
        emitDetail = 'Skipped (parse failed)';
    }

    // ── 5. Structure comparison ─────────────────────────────

    if (rubric.referenceSolution && ir) {
        try {
            const refDoc = parseLatex(rubric.referenceSolution);
            const refIR = documentToIR(refDoc, bundle);

            const studentDecls = new Map(ir.declarations.map(d => [d.name, d]));
            const refDecls = refIR.declarations;
            let matched = 0;

            for (const refDecl of refDecls) {
                const studentDecl = studentDecls.get(refDecl.name);
                if (studentDecl && studentDecl.tag === refDecl.tag) {
                    matched++;
                    // Check structural similarity
                    if (refDecl.tag === 'Theorem' && studentDecl.tag === 'Theorem') {
                        const refPretty = prettyTerm(refDecl.statement);
                        const stuPretty = prettyTerm(studentDecl.statement);
                        if (refPretty === stuPretty) {
                            const tg = theoremGrades.find(t => t.name === refDecl.name);
                            if (tg) tg.structureMatch = true;
                        }
                    }
                }
            }

            const ratio = refDecls.length > 0 ? matched / refDecls.length : 1;
            structEarned = Math.round(pts.structure * ratio);
            structDetail = `${matched}/${refDecls.length} declarations match reference`;
        } catch {
            structDetail = 'Reference solution parse failed';
            structEarned = 0;
        }
    } else {
        // No reference solution, give full points for structure
        structEarned = pts.structure;
        structDetail = 'No reference solution provided';
    }

    // ── Compute final grade ─────────────────────────────────

    const totalPoints = Math.min(
        parseEarned + tcEarned + qcEarned + emitEarned + structEarned,
        maxPoints,
    );
    const percentage = Math.round((totalPoints / maxPoints) * 1000) / 10;

    if (percentage >= 90) overallFeedback.unshift('Excellent work! Your proofs are well-formed and pass all checks.');
    else if (percentage >= 80) overallFeedback.unshift('Good submission. A few issues to address.');
    else if (percentage >= 70) overallFeedback.unshift('Decent attempt, but several issues found.');
    else if (percentage >= 60) overallFeedback.unshift('Below expectations. Please review the feedback carefully.');
    else overallFeedback.unshift('Significant issues found. Consider reviewing the material and resubmitting.');

    return {
        studentId,
        submissionTime: new Date().toISOString(),
        totalPoints: Math.round(totalPoints * 10) / 10,
        maxPoints,
        percentage,
        letterGrade: percentToLetter(percentage),
        theorems: theoremGrades,
        overallFeedback,
        breakdown: {
            parsing: { earned: parseEarned, possible: pts.parsing, detail: parseDetail },
            typeCheck: { earned: tcEarned, possible: pts.typeCheck, detail: tcDetail },
            quickCheck: { earned: qcEarned, possible: pts.quickCheck, detail: qcDetail },
            emission: { earned: emitEarned, possible: pts.emission, detail: emitDetail },
            structure: { earned: structEarned, possible: pts.structure, detail: structDetail },
        },
        diagnostics,
        elapsed: Math.round((performance.now() - start) * 100) / 100,
    };
}

// ── Helpers ─────────────────────────────────────────────────

function percentToLetter(pct: number): string {
    if (pct >= 93) return 'A';
    if (pct >= 90) return 'A-';
    if (pct >= 87) return 'B+';
    if (pct >= 83) return 'B';
    if (pct >= 80) return 'B-';
    if (pct >= 77) return 'C+';
    if (pct >= 73) return 'C';
    if (pct >= 70) return 'C-';
    if (pct >= 67) return 'D+';
    if (pct >= 60) return 'D';
    return 'F';
}

function hasNameMatch(name: string, expected: Set<string>): boolean {
    const normalized = name.toLowerCase().replace(/[_\s-]/g, '');
    for (const exp of expected) {
        const normExp = exp.toLowerCase().replace(/[_\s-]/g, '');
        if (normalized.includes(normExp) || normExp.includes(normalized)) return true;
    }
    return false;
}
