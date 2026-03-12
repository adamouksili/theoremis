// ─────────────────────────────────────────────────────────────
// Theoremis  ·  API Pipeline
// Unified pipeline that all API endpoints call into.
// This is the single function that wires together:
//   LaTeX → AST → IR → TypeCheck → Emit → QuickCheck
// ─────────────────────────────────────────────────────────────

import { parseLatex, parseExpr, documentToIR } from '../parser/latex';
import {
    typeCheck,
    type TypeCheckMode,
    type TypeCheckResult,
    type StrictDiagnostics,
} from '../core/typechecker';
import { emitLean4 } from '../emitters/lean4';
import { emitCoq } from '../emitters/coq';
import { emitIsabelle } from '../emitters/isabelle';
import { quickCheck, extractVariables, type QuickCheckOptions } from '../engine/evaluator';
import { BUNDLES, type AxiomBundle, type IRModule } from '../core/ir';
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
    strictDiagnostics?: StrictDiagnosticsMeta;
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
        analyzedTheoremCount: number;
        axiomBudget: string[];
        typeCheckValid: boolean;
        diagnosticCount: number;
    };
    truncated: boolean;
    truncationReason?: string;
    strictDiagnostics?: StrictDiagnosticsMeta;
}

export interface AnalyzeOptions extends QuickCheckOptions {
    numTests?: number;
    maxWorkItems?: number;
    typeCheckMode?: TypeCheckMode;
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

interface PipelineContext {
    bundle: AxiomBundle;
    doc: ReturnType<typeof parseLatex>;
    ir: IRModule;
    tc: TypeCheckResult;
    typeCheckMode: TypeCheckMode;
}

export interface StrictDiagnosticsMeta extends StrictDiagnostics {
    mode: TypeCheckMode;
    errorCount: number;
}

// ── Resolve axiom bundle from string ────────────────────────

function resolveBundle(name?: string): AxiomBundle {
    if (!name) return BUNDLES.ClassicalMath!;
    return BUNDLES[name] ?? BUNDLES.ClassicalMath!;
}

// ── Shared pipeline context ─────────────────────────────────

export function buildPipelineContext(
    latex: string,
    bundleName?: string,
    typeCheckMode: TypeCheckMode = 'permissive',
): PipelineContext {
    const bundle = resolveBundle(bundleName);
    const doc = parseLatex(latex);
    const ir = documentToIR(doc, bundle);
    const tc = typeCheck(ir, { mode: typeCheckMode });
    return { bundle, doc, ir, tc, typeCheckMode };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function serializeParseContext(ctx: PipelineContext, startedAt: number): ParseResult {
    const strictDiagnostics = getStrictDiagnosticsMeta(ctx.tc);
    return {
        document: serializeDocument(ctx.doc),
        ir: serializeModule(ctx.ir),
        typeCheck: serializeTypeCheck(ctx.tc),
        ...(strictDiagnostics ? { strictDiagnostics } : {}),
        elapsed: round2(performance.now() - startedAt),
    };
}

function getStrictDiagnosticsMeta(tc: TypeCheckResult): StrictDiagnosticsMeta | undefined {
    if (tc.mode !== 'strict' || !tc.strictDiagnostics) return undefined;
    return {
        mode: tc.mode,
        errorCount: tc.diagnostics.filter(d => d.severity === 'error').length,
        fallbackErrors: tc.strictDiagnostics.fallbackErrors,
        unresolvedTermErrors: tc.strictDiagnostics.unresolvedTermErrors,
        universeErrors: tc.strictDiagnostics.universeErrors,
    };
}

function emitFromContext(ctx: PipelineContext, targets?: string[]): EmitResult {
    const validTargets = new Set(targets ?? ['lean4', 'coq', 'isabelle']);

    const lean4 = validTargets.has('lean4') ? emitLean4(ctx.ir) : { code: '', warnings: ['skipped'] };
    const coq = validTargets.has('coq') ? emitCoq(ctx.ir) : { code: '', warnings: ['skipped'] };
    const isabelle = validTargets.has('isabelle') ? emitIsabelle(ctx.ir) : { code: '', warnings: ['skipped'] };

    return {
        lean4: { code: lean4.code, warnings: lean4.warnings },
        coq: { code: coq.code, warnings: coq.warnings },
        isabelle: { code: isabelle.code, warnings: isabelle.warnings },
    };
}

function analyzeFromContext(
    ctx: PipelineContext,
    numTests: number,
    options: AnalyzeOptions,
): AnalyzeResult {
    const start = performance.now();
    const deadline = typeof options.timeoutMs === 'number'
        ? start + options.timeoutMs
        : Number.POSITIVE_INFINITY;
    const workCap = typeof options.maxWorkItems === 'number' ? options.maxWorkItems : Number.POSITIVE_INFINITY;

    const theorems: TheoremAnalysis[] = [];

    let theoremCount = 0;
    let definitionCount = 0;
    let lemmaCount = 0;
    let analyzedTheoremCount = 0;
    let truncated = false;
    let truncationReason: string | undefined;
    const strictMeta = getStrictDiagnosticsMeta(ctx.tc);

    const nextQuickCheckOptions = (index: number): QuickCheckOptions => {
        const seed = typeof options.seed === 'number' ? options.seed + index : undefined;
        const remainingMs = Number.isFinite(deadline)
            ? Math.max(1, Math.floor(deadline - performance.now()))
            : options.timeoutMs;
        return {
            seed,
            timeoutMs: remainingMs,
            maxCounterexamples: options.maxCounterexamples,
        };
    };

    for (const decl of ctx.ir.declarations) {
        if (decl.tag === 'Theorem') theoremCount++;
        if (decl.tag === 'Definition') definitionCount++;
        if (decl.tag === 'Lemma') lemmaCount++;

        if (decl.tag !== 'Theorem' && decl.tag !== 'Lemma') continue;
        if (analyzedTheoremCount >= workCap) {
            truncated = true;
            truncationReason = `maxWorkItems limit reached (${workCap})`;
            break;
        }
        if (performance.now() >= deadline) {
            truncated = true;
            truncationReason = `timeoutMs reached (${options.timeoutMs} ms)`;
            break;
        }

        const vars = extractVariables(decl.statement);
        let qcResult: Record<string, unknown> | null = null;
        analyzedTheoremCount++;

        if (vars.length > 0) {
            const report = quickCheck(
                decl.statement,
                vars,
                numTests,
                decl.params,
                nextQuickCheckOptions(analyzedTheoremCount),
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
            proofStrategy: decl.proof.length > 0 ? decl.proof[0]!.tag : null,
            axioms: decl.tag === 'Theorem' ? Array.from(decl.axiomBundle.axioms) : [],
        });
    }

    return {
        theorems,
        overall: {
            totalDeclarations: ctx.ir.declarations.length,
            theoremCount,
            definitionCount,
            lemmaCount,
            analyzedTheoremCount,
            axiomBudget: Array.from(ctx.bundle.axioms),
            typeCheckValid: ctx.tc.valid,
            diagnosticCount: ctx.tc.diagnostics.length,
        },
        truncated,
        ...(truncationReason ? { truncationReason } : {}),
        ...(strictMeta ? { strictDiagnostics: strictMeta } : {}),
    };
}

// ── Parse endpoint ──────────────────────────────────────────

export function apiParse(
    latex: string,
    bundleName?: string,
    typeCheckMode: TypeCheckMode = 'permissive',
): ParseResult {
    const start = performance.now();
    const ctx = buildPipelineContext(latex, bundleName, typeCheckMode);
    return serializeParseContext(ctx, start);
}

// ── Emit endpoint ───────────────────────────────────────────

export function apiEmit(latex: string, bundleName?: string, targets?: string[]): EmitResult {
    const ctx = buildPipelineContext(latex, bundleName);
    return emitFromContext(ctx, targets);
}

// ── Analyze endpoint (the money maker) ──────────────────────

export function apiAnalyze(
    latex: string,
    bundleName?: string,
    numTests: number = 500,
    options: AnalyzeOptions = {},
): AnalyzeResult {
    const ctx = buildPipelineContext(latex, bundleName, options.typeCheckMode ?? 'permissive');
    return analyzeFromContext(ctx, numTests, options);
}

// ── Full pipeline (parse + emit + analyze in one call) ──────

export function apiFullPipeline(
    latex: string,
    bundleName?: string,
    analyzeOptions: AnalyzeOptions = {},
): FullPipelineResult {
    const start = performance.now();
    const ctx = buildPipelineContext(
        latex,
        bundleName,
        analyzeOptions.typeCheckMode ?? 'permissive',
    );

    const { numTests = 500, seed, timeoutMs, maxCounterexamples, maxWorkItems, typeCheckMode } = analyzeOptions;

    return {
        parse: serializeParseContext(ctx, start),
        emit: emitFromContext(ctx),
        analysis: analyzeFromContext(ctx, numTests, {
            seed,
            timeoutMs,
            maxCounterexamples,
            maxWorkItems,
            typeCheckMode,
        }),
    };
}

// ── Parse a single expression (lightweight) ─────────────────

export function apiParseExpr(latex: string): Record<string, unknown> {
    const term = parseExpr(latex);
    return serializeTerm(term);
}
