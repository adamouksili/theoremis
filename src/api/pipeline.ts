// ─────────────────────────────────────────────────────────────
// Theoremis  ·  API Pipeline
// Unified pipeline that all API endpoints call into.
// This is the single function that wires together:
//   LaTeX → AST → IR → TypeCheck → Emit → QuickCheck
// ─────────────────────────────────────────────────────────────

import { parseLatex, parseExpr, documentToIR } from '../parser/latex';
import { typeCheck } from '../core/typechecker';
import { emitLean4 } from '../emitters/lean4';
import { emitCoq } from '../emitters/coq';
import { emitIsabelle } from '../emitters/isabelle';
import { quickCheck, extractVariables } from '../engine/evaluator';
import { BUNDLES } from '../core/ir';
import type { AxiomBundle } from '../core/ir';
import {
    serializeDocument,
    serializeModule,
    serializeTypeCheck,
    serializeTerm,
    serializeTestReport,
} from './serialize';

// ── Public API types ────────────────────────────────────────

export interface ParseResult {
    document: Record<string, unknown>;
    ir: Record<string, unknown>;
    typeCheck: Record<string, unknown>;
    elapsed: number;
}

export interface EmitResult {
    lean4: { code: string; warnings: string[] };
    coq: { code: string; warnings: string[] };
    isabelle: { code: string; warnings: string[] };
}

export interface AnalyzeResult {
    theorems: TheoremAnalysis[];
    overall: {
        totalDeclarations: number;
        theoremCount: number;
        definitionCount: number;
        lemmaCount: number;
        axiomBudget: string[];
        typeCheckValid: boolean;
        diagnosticCount: number;
    };
}

export interface TheoremAnalysis {
    name: string;
    tag: string;
    statement: Record<string, unknown>;
    params: Array<Record<string, unknown>>;
    quickCheck: Record<string, unknown> | null;
    proofStrategy: string | null;
    axioms: string[];
}

export interface FullPipelineResult {
    parse: ParseResult;
    emit: EmitResult;
    analysis: AnalyzeResult;
}

// ── Resolve axiom bundle from string ────────────────────────

function resolveBundle(name?: string): AxiomBundle {
    if (!name) return BUNDLES.ClassicalMath;
    return BUNDLES[name] ?? BUNDLES.ClassicalMath;
}

// ── Parse endpoint ──────────────────────────────────────────

export function apiParse(latex: string, bundleName?: string): ParseResult {
    const start = performance.now();
    const bundle = resolveBundle(bundleName);

    const doc = parseLatex(latex);
    const ir = documentToIR(doc, bundle);
    const tc = typeCheck(ir);

    return {
        document: serializeDocument(doc),
        ir: serializeModule(ir),
        typeCheck: serializeTypeCheck(tc),
        elapsed: Math.round((performance.now() - start) * 100) / 100,
    };
}

// ── Emit endpoint ───────────────────────────────────────────

export function apiEmit(latex: string, bundleName?: string, targets?: string[]): EmitResult {
    const bundle = resolveBundle(bundleName);
    const doc = parseLatex(latex);
    const ir = documentToIR(doc, bundle);

    const validTargets = new Set(targets ?? ['lean4', 'coq', 'isabelle']);

    const lean4 = validTargets.has('lean4') ? emitLean4(ir) : { code: '', warnings: ['skipped'] };
    const coq = validTargets.has('coq') ? emitCoq(ir) : { code: '', warnings: ['skipped'] };
    const isabelle = validTargets.has('isabelle') ? emitIsabelle(ir) : { code: '', warnings: ['skipped'] };

    return {
        lean4: { code: lean4.code, warnings: lean4.warnings },
        coq: { code: coq.code, warnings: coq.warnings },
        isabelle: { code: isabelle.code, warnings: isabelle.warnings },
    };
}

// ── Analyze endpoint (the money maker) ──────────────────────

export function apiAnalyze(latex: string, bundleName?: string, numTests: number = 500): AnalyzeResult {
    const bundle = resolveBundle(bundleName);
    const doc = parseLatex(latex);
    const ir = documentToIR(doc, bundle);
    const tc = typeCheck(ir);

    const theorems: TheoremAnalysis[] = [];

    for (const decl of ir.declarations) {
        if (decl.tag === 'Theorem' || decl.tag === 'Lemma') {
            const vars = extractVariables(decl.statement);
            let qcResult: Record<string, unknown> | null = null;

            if (vars.length > 0) {
                const report = quickCheck(
                    decl.statement,
                    vars,
                    numTests,
                    decl.params,
                );
                qcResult = serializeTestReport(report);
            }

            theorems.push({
                name: decl.name,
                tag: decl.tag,
                statement: serializeTerm(decl.statement),
                params: decl.params.map(p => ({
                    name: p.name,
                    type: serializeTerm(p.type),
                    implicit: p.implicit,
                })),
                quickCheck: qcResult,
                proofStrategy: decl.tag === 'Theorem'
                    ? (decl.proof.length > 0 ? decl.proof[0].tag : null)
                    : (decl.proof.length > 0 ? decl.proof[0].tag : null),
                axioms: decl.tag === 'Theorem' ? Array.from(decl.axiomBundle.axioms) : [],
            });
        }
    }

    return {
        theorems,
        overall: {
            totalDeclarations: ir.declarations.length,
            theoremCount: ir.declarations.filter(d => d.tag === 'Theorem').length,
            definitionCount: ir.declarations.filter(d => d.tag === 'Definition').length,
            lemmaCount: ir.declarations.filter(d => d.tag === 'Lemma').length,
            axiomBudget: Array.from(bundle.axioms),
            typeCheckValid: tc.valid,
            diagnosticCount: tc.diagnostics.length,
        },
    };
}

// ── Full pipeline (parse + emit + analyze in one call) ──────

export function apiFullPipeline(latex: string, bundleName?: string): FullPipelineResult {
    return {
        parse: apiParse(latex, bundleName),
        emit: apiEmit(latex, bundleName),
        analysis: apiAnalyze(latex, bundleName),
    };
}

// ── Parse a single expression (lightweight) ─────────────────

export function apiParseExpr(latex: string): Record<string, unknown> {
    const term = parseExpr(latex);
    return serializeTerm(term);
}
