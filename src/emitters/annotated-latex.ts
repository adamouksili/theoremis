// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Annotated LaTeX Export
// Generates LaTeX output with verification annotations,
// hyperlinks to formal proofs, and proof status markers
// ─────────────────────────────────────────────────────────────

import type { IRModule, Declaration } from '../core/ir';
import type { TypeCheckResult } from '../core/typechecker';
import type { EmitterResult } from '../emitters/lean4';
import type { PathologyReport } from '../engine/counterexample';

export interface AnnotationOptions {
    includeStatus: boolean;
    includeLeanLinks: boolean;
    includeCounterexamples: boolean;
    colorize: boolean;
}

const DEFAULT_OPTIONS: AnnotationOptions = {
    includeStatus: true,
    includeLeanLinks: true,
    includeCounterexamples: true,
    colorize: true,
};

export function exportAnnotatedLaTeX(
    originalSource: string,
    ir: IRModule,
    tc: TypeCheckResult,
    lean4?: EmitterResult | null,
    report?: PathologyReport | null,
    options: Partial<AnnotationOptions> = {},
): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const lines: string[] = [];

    // ── Preamble additions ──────────────────────────────────
    lines.push('% ══════════════════════════════════════════════════════════════');
    lines.push('% Annotated by Theoremis · Formal Verification Pipeline');
    lines.push(`% Generated: ${new Date().toISOString()}`);
    lines.push(`% Declarations: ${ir.declarations.length}`);
    lines.push(`% Axiom bundle: ${ir.axiomBundle.name}`);
    lines.push(`% Type-check: ${tc.valid ? 'PASSED' : 'FAILED'} (${tc.diagnostics.length} diagnostics)`);
    lines.push('% ══════════════════════════════════════════════════════════════');
    lines.push('');

    if (opts.colorize) {
        lines.push('\\usepackage{xcolor}');
        lines.push('\\usepackage{hyperref}');
        lines.push('\\definecolor{svgreen}{HTML}{16a34a}');
        lines.push('\\definecolor{svyellow}{HTML}{d97706}');
        lines.push('\\definecolor{svred}{HTML}{dc2626}');
        lines.push('\\newcommand{\\svstatus}[2]{\\marginpar{\\tiny\\textcolor{#1}{#2}}}');
        lines.push('');
    }

    // ── Process original source ─────────────────────────────
    const srcLines = originalSource.split('\n');

    for (let i = 0; i < srcLines.length; i++) {
        let line = srcLines[i];

        // Check if this line starts a theorem/definition environment
        const envMatch = line.match(/\\begin\{(theorem|definition|lemma)\}(?:\[([^\]]*)\])?/);

        if (envMatch && opts.includeStatus) {
            const envType = envMatch[1];
            const envName = envMatch[2] || '';

            // Find corresponding declaration
            const decl = findDeclaration(ir, envName, envType);
            if (decl) {
                const status = getStatus(decl, tc);
                const statusColor = status === 'verified' ? 'svgreen' : status === 'partial' ? 'svyellow' : 'svred';
                const statusIcon = status === 'verified' ? '✓' : status === 'partial' ? '⚠' : '✗';

                lines.push(`% ── Theoremis: ${decl.tag} "${decl.name}" — ${status} ──`);

                if (opts.colorize) {
                    lines.push(`${line} \\svstatus{${statusColor}}{${statusIcon} ${status}}`);
                } else {
                    lines.push(line);
                }

                // Add Lean 4 cross-reference
                if (opts.includeLeanLinks && lean4) {
                    lines.push(`% Lean 4: see output.lean for formal statement`);
                }

                // Add counterexample annotation
                if (opts.includeCounterexamples && report) {
                    const ceResults = report.results.filter(r => r.status === 'counterexample_found');
                    if (ceResults.length > 0) {
                        lines.push(`% ⚠ ${ceResults.length} mutation(s) found counterexamples (confidence: ${(report.overallConfidence * 100).toFixed(0)}%)`);
                    } else {
                        lines.push(`% ✓ No counterexamples found (confidence: ${(report.overallConfidence * 100).toFixed(0)}%)`);
                    }
                }

                continue;
            }
        }

        lines.push(line);
    }

    // ── Appendix: Formal verification summary ───────────────
    lines.push('');
    lines.push('% ══════════════════════════════════════════════════════════════');
    lines.push('% Theoremis Formal Verification Summary');
    lines.push('% ══════════════════════════════════════════════════════════════');

    for (const decl of ir.declarations) {
        const status = getStatus(decl, tc);
        const diags = tc.diagnostics.filter(d => d.location === decl.name);
        lines.push(`% ${decl.tag} ${decl.name}: ${status}`);
        for (const d of diags) {
            lines.push(`%   [${d.severity}] ${d.message}`);
        }
    }

    if (tc.axiomUsage.size > 0) {
        lines.push(`% Axioms used: ${[...tc.axiomUsage].join(', ')}`);
    }

    return lines.join('\n');
}

function findDeclaration(ir: IRModule, name: string, kind: string): Declaration | undefined {
    return ir.declarations.find(d => {
        const nameMatch = d.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(d.name.toLowerCase());
        const kindMatch = d.tag.toLowerCase() === kind.toLowerCase();
        return (name ? nameMatch : true) && kindMatch;
    });
}

function getStatus(decl: Declaration, tc: TypeCheckResult): 'verified' | 'partial' | 'unverified' {
    const diags = tc.diagnostics.filter(d => d.location === decl.name);
    if (diags.some(d => d.severity === 'error')) return 'unverified';
    if (diags.some(d => d.severity === 'warning')) return 'partial';
    return 'verified';
}
