// ─────────────────────────────────────────────────────────────
// Theoremis  ·  IR Serialization Layer
// Converts internal IR types to clean JSON for the public API
// ─────────────────────────────────────────────────────────────

import type { Term, Tactic, Declaration, IRModule, Param } from '../core/ir';
import type { MathDocument, MathNode } from '../parser/ast';
import type { TypeCheckResult } from '../core/typechecker';
import type { RandomTestReport } from '../engine/evaluator';

// ── Term → JSON ─────────────────────────────────────────────

export function serializeTerm(term: Term): Record<string, unknown> {
    switch (term.tag) {
        case 'Var':
            return { tag: 'Var', name: term.name };
        case 'Literal':
            return { tag: 'Literal', kind: term.kind, value: term.value };
        case 'Lam':
            return { tag: 'Lam', param: term.param, paramType: serializeTerm(term.paramType), body: serializeTerm(term.body) };
        case 'App':
            return { tag: 'App', func: serializeTerm(term.func), arg: serializeTerm(term.arg) };
        case 'Pi':
            return { tag: 'Pi', param: term.param, paramType: serializeTerm(term.paramType), body: serializeTerm(term.body) };
        case 'Sigma':
            return { tag: 'Sigma', param: term.param, paramType: serializeTerm(term.paramType), body: serializeTerm(term.body) };
        case 'Pair':
            return { tag: 'Pair', fst: serializeTerm(term.fst), snd: serializeTerm(term.snd) };
        case 'Proj':
            return { tag: 'Proj', term: serializeTerm(term.term), index: term.index };
        case 'LetIn':
            return { tag: 'LetIn', name: term.name, type: serializeTerm(term.type), value: serializeTerm(term.value), body: serializeTerm(term.body) };
        case 'Sort':
            return { tag: 'Sort', universe: term.universe };
        case 'Ind':
            return { tag: 'Ind', name: term.name, type: serializeTerm(term.type), constructors: term.constructors.map(c => ({ name: c.name, type: serializeTerm(c.type) })) };
        case 'Match':
            return { tag: 'Match', scrutinee: serializeTerm(term.scrutinee), cases: term.cases.map(c => ({ pattern: c.pattern, bindings: c.bindings, body: serializeTerm(c.body) })) };
        case 'Hole':
            return { tag: 'Hole', id: term.id, context: term.context };
        case 'AxiomRef':
            return { tag: 'AxiomRef', axiom: term.axiom };
        case 'BinOp':
            return { tag: 'BinOp', op: term.op, left: serializeTerm(term.left), right: serializeTerm(term.right) };
        case 'UnaryOp':
            return { tag: 'UnaryOp', op: term.op, operand: serializeTerm(term.operand) };
        case 'Equiv':
            return { tag: 'Equiv', left: serializeTerm(term.left), right: serializeTerm(term.right), modulus: term.modulus ? serializeTerm(term.modulus) : null };
        case 'ForAll':
            return { tag: 'ForAll', param: term.param, domain: serializeTerm(term.domain), body: serializeTerm(term.body) };
        case 'Exists':
            return { tag: 'Exists', param: term.param, domain: serializeTerm(term.domain), body: serializeTerm(term.body) };
    }
}

// ── Declaration → JSON ──────────────────────────────────────

export function serializeDeclaration(decl: Declaration): Record<string, unknown> {
    switch (decl.tag) {
        case 'Definition':
            return {
                tag: 'Definition',
                name: decl.name,
                params: decl.params.map(serializeParam),
                returnType: serializeTerm(decl.returnType),
                body: serializeTerm(decl.body),
            };
        case 'Theorem':
            return {
                tag: 'Theorem',
                name: decl.name,
                params: decl.params.map(serializeParam),
                statement: serializeTerm(decl.statement),
                proof: decl.proof.map(serializeTactic),
                axioms: Array.from(decl.axiomBundle.axioms),
                metadata: decl.metadata,
            };
        case 'Lemma':
            return {
                tag: 'Lemma',
                name: decl.name,
                params: decl.params.map(serializeParam),
                statement: serializeTerm(decl.statement),
                proof: decl.proof.map(serializeTactic),
            };
    }
}

function serializeParam(p: Param): Record<string, unknown> {
    return { name: p.name, type: serializeTerm(p.type), implicit: p.implicit };
}

function serializeTactic(t: Tactic): Record<string, unknown> {
    switch (t.tag) {
        case 'Intro': return { tag: 'Intro', names: t.names };
        case 'Apply': return { tag: 'Apply', term: serializeTerm(t.term) };
        case 'Rewrite': return { tag: 'Rewrite', term: serializeTerm(t.term), direction: t.direction };
        case 'Induction': return { tag: 'Induction', name: t.name };
        case 'Cases': return { tag: 'Cases', term: serializeTerm(t.term) };
        case 'Simp': return { tag: 'Simp', lemmas: t.lemmas };
        case 'Omega': return { tag: 'Omega' };
        case 'Sorry': return { tag: 'Sorry' };
        case 'Auto': return { tag: 'Auto', depth: t.depth };
        case 'Seq': return { tag: 'Seq', tactics: t.tactics.map(serializeTactic) };
        case 'Alt': return { tag: 'Alt', tactics: t.tactics.map(serializeTactic) };
        case 'Exact': return { tag: 'Exact', term: serializeTerm(t.term) };
        case 'Ring': return { tag: 'Ring' };
        case 'LLMSuggest': return { tag: 'LLMSuggest', context: t.context };
    }
}

// ── IRModule → JSON ─────────────────────────────────────────

export function serializeModule(mod: IRModule): Record<string, unknown> {
    return {
        name: mod.name,
        declarations: mod.declarations.map(serializeDeclaration),
        axiomBundle: {
            name: mod.axiomBundle.name,
            axioms: Array.from(mod.axiomBundle.axioms),
            description: mod.axiomBundle.description,
        },
        imports: mod.imports,
    };
}

// ── MathDocument → JSON ─────────────────────────────────────

export function serializeDocument(doc: MathDocument): Record<string, unknown> {
    return {
        title: doc.title,
        nodes: doc.nodes.map(serializeNode),
        dependencies: doc.dependencies,
        parseErrors: doc.parseErrors ?? [],
    };
}

function serializeNode(node: MathNode): Record<string, unknown> {
    switch (node.tag) {
        case 'ThmNode':
        case 'LemmaNode':
            return {
                tag: node.tag,
                name: node.name,
                label: node.label,
                hypotheses: node.hypotheses.map(h => ({
                    name: h.name,
                    condition: serializeTerm(h.condition),
                    description: h.description,
                })),
                conclusion: serializeTerm(node.conclusion),
                hasProof: node.proof !== null,
                proofStrategy: node.proof?.strategy ?? null,
                line: node.line,
            };
        case 'DefNode':
            return {
                tag: 'DefNode',
                name: node.name,
                params: node.params.map(p => ({ name: p.name, type: serializeTerm(p.type), description: p.description })),
                body: node.body ? serializeTerm(node.body) : null,
                line: node.line,
            };
        case 'ProofNode':
            return {
                tag: 'ProofNode',
                strategy: node.strategy,
                tacticsCount: node.tactics.length,
                line: node.line,
            };
        case 'RemarkNode':
            return { tag: 'RemarkNode', content: node.content, line: node.line };
        case 'ExampleNode':
            return { tag: 'ExampleNode', content: node.content, line: node.line };
        case 'SectionNode':
            return { tag: 'SectionNode', title: node.title, children: node.children.map(serializeNode), line: node.line };
        case 'RefNode':
            return { tag: 'RefNode', target: node.target, kind: node.kind, line: node.line };
    }
}

// ── TypeCheckResult → JSON ──────────────────────────────────

export function serializeTypeCheck(tc: TypeCheckResult): Record<string, unknown> {
    return {
        valid: tc.valid,
        mode: tc.mode,
        diagnostics: tc.diagnostics.map(d => ({
            severity: d.severity,
            message: d.message,
            location: d.location ?? null,
        })),
        holes: tc.holes.map(h => ({
            id: h.id,
            suggestions: h.suggestions,
        })),
        axiomUsage: Array.from(tc.axiomUsage),
        inferredTypes: Object.fromEntries(
            Array.from(tc.inferredTypes.entries()).map(([k, v]) => [k, serializeTerm(v)])
        ),
        strictDiagnostics: tc.strictDiagnostics ?? null,
    };
}

// ── RandomTestReport → JSON ─────────────────────────────────

export function serializeTestReport(report: RandomTestReport): Record<string, unknown> {
    return {
        totalTests: report.totalTests,
        passed: report.passed,
        failed: report.failed,
        skipped: report.skipped,
        preconditionSkipped: report.preconditionSkipped,
        classification: report.classification,
        time: Math.round(report.time * 100) / 100,
        counterexamples: report.counterexamples.slice(0, 5).map(ce => ({
            passed: ce.passed,
            witness: ce.witness,
            evaluated: ce.evaluated,
        })),
    };
}
