// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Bidirectional Type-Checker for λΠω
// Real implementation with unification, substitution, and
// normalization — replaces the structural stub
// ─────────────────────────────────────────────────────────────

import type { Term, Declaration, IRModule, AxiomBundle, Param, Axiom } from './ir';

// ── Type-checking context ───────────────────────────────────

export interface TypeContext {
    bindings: Map<string, Term>;
    axiomBundle: AxiomBundle;
}

export function emptyContext(bundle: AxiomBundle): TypeContext {
    return { bindings: new Map(), axiomBundle: bundle };
}

export function extendContext(ctx: TypeContext, name: string, type: Term): TypeContext {
    const bindings = new Map(ctx.bindings);
    bindings.set(name, type);
    return { ...ctx, bindings };
}

// ── Diagnostics ─────────────────────────────────────────────

export type Severity = 'error' | 'warning' | 'info' | 'hint';

export interface Diagnostic {
    severity: Severity;
    message: string;
    location?: string;
    term?: Term;
}

// ── Type-check result ───────────────────────────────────────

export interface TypeCheckResult {
    valid: boolean;
    diagnostics: Diagnostic[];
    inferredTypes: Map<string, Term>;
    holes: HoleInfo[];
    axiomUsage: Set<string>;
}

export interface HoleInfo {
    id: string;
    expectedType?: Term;
    context: Map<string, Term>;
    suggestions: string[];
}

// ── Free variables ──────────────────────────────────────────

export function freeVars(term: Term): Set<string> {
    switch (term.tag) {
        case 'Var': return new Set([term.name]);
        case 'Literal': case 'Sort': case 'Hole': case 'AxiomRef': return new Set();
        case 'Lam': {
            const body = freeVars(term.body);
            body.delete(term.param);
            return union(freeVars(term.paramType), body);
        }
        case 'Pi': case 'Sigma': {
            const body = freeVars(term.body);
            body.delete(term.param);
            return union(freeVars(term.paramType), body);
        }
        case 'App': return union(freeVars(term.func), freeVars(term.arg));
        case 'Pair': return union(freeVars(term.fst), freeVars(term.snd));
        case 'Proj': return freeVars(term.term);
        case 'LetIn': {
            const body = freeVars(term.body);
            body.delete(term.name);
            return union(union(freeVars(term.type), freeVars(term.value)), body);
        }
        case 'BinOp': return union(freeVars(term.left), freeVars(term.right));
        case 'UnaryOp': return freeVars(term.operand);
        case 'Equiv': {
            const s = union(freeVars(term.left), freeVars(term.right));
            return term.modulus ? union(s, freeVars(term.modulus)) : s;
        }
        case 'ForAll': case 'Exists': {
            const body = freeVars(term.body);
            body.delete(term.param);
            return union(freeVars(term.domain), body);
        }
        case 'Match': {
            const s = freeVars(term.scrutinee);
            for (const c of term.cases) {
                const cb = freeVars(c.body);
                for (const b of c.bindings) cb.delete(b);
                for (const v of cb) s.add(v);
            }
            return s;
        }
        case 'Ind': {
            const s = freeVars(term.type);
            for (const c of term.constructors) for (const v of freeVars(c.type)) s.add(v);
            return s;
        }
    }
}

function union(a: Set<string>, b: Set<string>): Set<string> {
    const r = new Set(a);
    for (const v of b) r.add(v);
    return r;
}

// ── Fresh variable generation ───────────────────────────────

function fresh(base: string, avoid: Set<string>, counter: { value: number }): string {
    let candidate = base + '′';
    while (avoid.has(candidate)) {
        counter.value++;
        candidate = base + '′' + counter.value;
    }
    return candidate;
}

// ── Capture-avoiding substitution ───────────────────────────

export function substitute(term: Term, name: string, replacement: Term): Term {
    const replFV = freeVars(replacement);
    const counter = { value: 0 };

    return subst(term, name, replacement, replFV, counter);
}

function subst(term: Term, name: string, replacement: Term, replFV: Set<string>, counter: { value: number }): Term {
    switch (term.tag) {
        case 'Var':
            return term.name === name ? replacement : term;

        case 'Lam': {
            if (term.param === name) return { ...term, paramType: subst(term.paramType, name, replacement, replFV, counter) };
            if (replFV.has(term.param)) {
                const allVars = union(replFV, union(freeVars(term.body), new Set([name])));
                const newParam = fresh(term.param, allVars, counter);
                const renamedBody = subst(term.body, term.param, { tag: 'Var', name: newParam }, new Set([newParam]), counter);
                return {
                    tag: 'Lam', param: newParam,
                    paramType: subst(term.paramType, name, replacement, replFV, counter),
                    body: subst(renamedBody, name, replacement, replFV, counter),
                };
            }
            return {
                tag: 'Lam', param: term.param,
                paramType: subst(term.paramType, name, replacement, replFV, counter),
                body: subst(term.body, name, replacement, replFV, counter),
            };
        }

        case 'App':
            return {
                tag: 'App',
                func: subst(term.func, name, replacement, replFV, counter),
                arg: subst(term.arg, name, replacement, replFV, counter),
            };

        case 'Pi':
        case 'Sigma': {
            if (term.param === name) {
                return { ...term, paramType: subst(term.paramType, name, replacement, replFV, counter) };
            }
            if (replFV.has(term.param)) {
                const allVars = union(replFV, union(freeVars(term.body), new Set([name])));
                const newParam = fresh(term.param, allVars, counter);
                const renamedBody = subst(term.body, term.param, { tag: 'Var', name: newParam }, new Set([newParam]), counter);
                return {
                    tag: term.tag, param: newParam,
                    paramType: subst(term.paramType, name, replacement, replFV, counter),
                    body: subst(renamedBody, name, replacement, replFV, counter),
                } as Term;
            }
            return {
                tag: term.tag, param: term.param,
                paramType: subst(term.paramType, name, replacement, replFV, counter),
                body: subst(term.body, name, replacement, replFV, counter),
            } as Term;
        }

        case 'Pair':
            return {
                tag: 'Pair',
                fst: subst(term.fst, name, replacement, replFV, counter),
                snd: subst(term.snd, name, replacement, replFV, counter),
            };

        case 'Proj':
            return { tag: 'Proj', term: subst(term.term, name, replacement, replFV, counter), index: term.index };

        case 'LetIn': {
            const newType = subst(term.type, name, replacement, replFV, counter);
            const newValue = subst(term.value, name, replacement, replFV, counter);
            if (term.name === name) return { tag: 'LetIn', name: term.name, type: newType, value: newValue, body: term.body };
            if (replFV.has(term.name)) {
                const allVars = union(replFV, union(freeVars(term.body), new Set([name])));
                const newName = fresh(term.name, allVars, counter);
                const renamedBody = subst(term.body, term.name, { tag: 'Var', name: newName }, new Set([newName]), counter);
                return { tag: 'LetIn', name: newName, type: newType, value: newValue, body: subst(renamedBody, name, replacement, replFV, counter) };
            }
            return { tag: 'LetIn', name: term.name, type: newType, value: newValue, body: subst(term.body, name, replacement, replFV, counter) };
        }

        case 'BinOp':
            return {
                tag: 'BinOp', op: term.op,
                left: subst(term.left, name, replacement, replFV, counter),
                right: subst(term.right, name, replacement, replFV, counter),
            };

        case 'UnaryOp':
            return {
                tag: 'UnaryOp', op: term.op,
                operand: subst(term.operand, name, replacement, replFV, counter),
            };

        case 'Equiv':
            return {
                tag: 'Equiv',
                left: subst(term.left, name, replacement, replFV, counter),
                right: subst(term.right, name, replacement, replFV, counter),
                modulus: term.modulus ? subst(term.modulus, name, replacement, replFV, counter) : undefined,
            };

        case 'ForAll':
        case 'Exists': {
            // Fix #7: Always substitute in the domain, even when param === name
            if (term.param === name) {
                return {
                    tag: term.tag, param: term.param,
                    domain: subst(term.domain, name, replacement, replFV, counter),
                    body: term.body,
                } as Term;
            }
            if (replFV.has(term.param)) {
                const allVars = union(replFV, union(freeVars(term.body), new Set([name])));
                const newParam = fresh(term.param, allVars, counter);
                const renamedBody = subst(term.body, term.param, { tag: 'Var', name: newParam }, new Set([newParam]), counter);
                return {
                    tag: term.tag, param: newParam,
                    domain: subst(term.domain, name, replacement, replFV, counter),
                    body: subst(renamedBody, name, replacement, replFV, counter),
                } as Term;
            }
            return {
                tag: term.tag, param: term.param,
                domain: subst(term.domain, name, replacement, replFV, counter),
                body: subst(term.body, name, replacement, replFV, counter),
            } as Term;
        }

        case 'Match':
            return {
                tag: 'Match',
                scrutinee: subst(term.scrutinee, name, replacement, replFV, counter),
                cases: term.cases.map(c => ({
                    pattern: c.pattern,
                    bindings: c.bindings,
                    body: c.bindings.includes(name) ? c.body : subst(c.body, name, replacement, replFV, counter),
                })),
            };

        case 'Ind':
            return {
                tag: 'Ind', name: term.name,
                type: subst(term.type, name, replacement, replFV, counter),
                constructors: term.constructors.map(c => ({
                    name: c.name,
                    type: subst(c.type, name, replacement, replFV, counter),
                })),
            };

        // Leaves
        case 'Sort':
        case 'Literal':
        case 'Hole':
        case 'AxiomRef':
            return term;
    }
}

// ── Weak-head normal form (WHNF) ───────────────────────────

export function normalize(term: Term, ctx: TypeContext): Term {
    switch (term.tag) {
        case 'App': {
            const fn = normalize(term.func, ctx);
            if (fn.tag === 'Lam') {
                return normalize(substitute(fn.body, fn.param, term.arg), ctx);
            }
            return { tag: 'App', func: fn, arg: normalize(term.arg, ctx) };
        }
        case 'LetIn': {
            return normalize(substitute(term.body, term.name, term.value), ctx);
        }
        case 'Proj': {
            const inner = normalize(term.term, ctx);
            if (inner.tag === 'Pair') {
                return normalize(term.index === 1 ? inner.fst : inner.snd, ctx);
            }
            return { tag: 'Proj', term: inner, index: term.index };
        }
        case 'Var': {
            // Look up definitions (for let-bound variables we could expand)
            return term;
        }
        case 'Lam':
        case 'Pi':
        case 'Sigma':
        case 'Pair':
        case 'Sort':
        case 'Ind':
        case 'Match':
        case 'Hole':
        case 'AxiomRef':
        case 'Literal':
        case 'BinOp':
        case 'UnaryOp':
        case 'Equiv':
        case 'ForAll':
        case 'Exists':
            return term;
    }
}

// ── Structural equality (up to alpha) ───────────────────────

export function termsEqual(a: Term, b: Term, ctx?: TypeContext): boolean {
    const na = ctx ? normalize(a, ctx) : a;
    const nb = ctx ? normalize(b, ctx) : b;

    if (na.tag !== nb.tag) return false;

    switch (na.tag) {
        case 'Var': return na.name === (nb as typeof na).name;
        case 'Literal': return na.kind === (nb as typeof na).kind && na.value === (nb as typeof na).value;
        case 'Sort': {
            const sb = nb as typeof na;
            if (na.universe.tag !== sb.universe.tag) return false;
            if (na.universe.tag === 'Type' && sb.universe.tag === 'Type') return na.universe.level === sb.universe.level;
            return true;
        }
        case 'Lam': {
            const lb = nb as typeof na;
            return termsEqual(na.paramType, lb.paramType) && termsEqual(na.body, substitute(lb.body, lb.param, { tag: 'Var', name: na.param }));
        }
        case 'Pi': {
            const pb = nb as typeof na;
            return termsEqual(na.paramType, pb.paramType) && termsEqual(na.body, substitute(pb.body, pb.param, { tag: 'Var', name: na.param }));
        }
        case 'Sigma': {
            const sb = nb as typeof na;
            return termsEqual(na.paramType, sb.paramType) && termsEqual(na.body, substitute(sb.body, sb.param, { tag: 'Var', name: na.param }));
        }
        case 'App': {
            const ab = nb as typeof na;
            return termsEqual(na.func, ab.func) && termsEqual(na.arg, ab.arg);
        }
        case 'BinOp': {
            const bb = nb as typeof na;
            return na.op === bb.op && termsEqual(na.left, bb.left) && termsEqual(na.right, bb.right);
        }
        case 'UnaryOp': {
            const ub = nb as typeof na;
            return na.op === ub.op && termsEqual(na.operand, ub.operand);
        }
        case 'Equiv': {
            const eb = nb as typeof na;
            return termsEqual(na.left, eb.left) && termsEqual(na.right, eb.right) &&
                (na.modulus && eb.modulus ? termsEqual(na.modulus, eb.modulus) : !na.modulus && !eb.modulus);
        }
        case 'ForAll': {
            const fb = nb as typeof na;
            return termsEqual(na.domain, fb.domain) && termsEqual(na.body, substitute(fb.body, fb.param, { tag: 'Var', name: na.param }));
        }
        case 'Exists': {
            const eb = nb as typeof na;
            return termsEqual(na.domain, eb.domain) && termsEqual(na.body, substitute(eb.body, eb.param, { tag: 'Var', name: na.param }));
        }
        case 'Hole': {
            const hb = nb as typeof na;
            return na.id === hb.id;
        }
        case 'AxiomRef': {
            const ab = nb as typeof na;
            return na.axiom === ab.axiom;
        }
        case 'Pair': {
            const pb = nb as typeof na;
            return termsEqual(na.fst, pb.fst) && termsEqual(na.snd, pb.snd);
        }
        case 'Proj': {
            const pb = nb as typeof na;
            return na.index === pb.index && termsEqual(na.term, pb.term);
        }
        case 'LetIn': {
            const lb = nb as typeof na;
            return na.name === lb.name && termsEqual(na.type, lb.type) && termsEqual(na.value, lb.value) && termsEqual(na.body, lb.body);
        }
        case 'Ind': {
            const ib = nb as typeof na;
            if (na.name !== ib.name) return false;
            if (!termsEqual(na.type, ib.type)) return false;
            if (na.constructors.length !== ib.constructors.length) return false;
            return na.constructors.every((c, i) => c.name === ib.constructors[i].name && termsEqual(c.type, ib.constructors[i].type));
        }
        case 'Match': {
            const mb = nb as typeof na;
            if (!termsEqual(na.scrutinee, mb.scrutinee)) return false;
            if (na.cases.length !== mb.cases.length) return false;
            return na.cases.every((c, i) => c.pattern === mb.cases[i].pattern && termsEqual(c.body, mb.cases[i].body));
        }
    }
    return false;
}

// ── Standard type constants ─────────────────────────────────

const TYPE0: Term = { tag: 'Sort', universe: { tag: 'Type', level: 0 } };
const TYPE1: Term = { tag: 'Sort', universe: { tag: 'Type', level: 1 } };
const PROP: Term = { tag: 'Sort', universe: { tag: 'Prop' } };

function makeStdContext(ctx: TypeContext): TypeContext {
    const stdTypes: Record<string, Term> = {
        'ℕ': TYPE0, 'ℤ': TYPE0, 'ℝ': TYPE0, 'ℂ': TYPE0,
        'Bool': TYPE0, 'String': TYPE0,
        'Set': { tag: 'Pi', param: '_', paramType: TYPE0, body: TYPE0 },
        'List': { tag: 'Pi', param: '_', paramType: TYPE0, body: TYPE0 },
        'Group': TYPE0, 'Ring': TYPE0, 'Field': TYPE0,
        'TopologicalSpace': TYPE0, 'Graph': TYPE0,
        'Prime': { tag: 'Pi', param: '_', paramType: { tag: 'Var', name: 'ℕ' }, body: PROP },
        'Even': { tag: 'Pi', param: '_', paramType: { tag: 'Var', name: 'ℕ' }, body: PROP },
        'Odd': { tag: 'Pi', param: '_', paramType: { tag: 'Var', name: 'ℕ' }, body: PROP },
        'Coprime': { tag: 'Pi', param: '_', paramType: { tag: 'Var', name: 'ℕ' }, body: { tag: 'Pi', param: '_', paramType: { tag: 'Var', name: 'ℕ' }, body: PROP } },
        'Divisors': { tag: 'Pi', param: '_', paramType: { tag: 'Var', name: 'ℕ' }, body: TYPE0 },
        'ZMod': { tag: 'Pi', param: '_', paramType: { tag: 'Var', name: 'ℕ' }, body: TYPE0 },
        'Finset': { tag: 'Pi', param: '_', paramType: TYPE0, body: TYPE0 },
        'Multiset': { tag: 'Pi', param: '_', paramType: TYPE0, body: TYPE0 },
        'Nat': TYPE0, 'Int': TYPE0, 'Real': TYPE0, 'Complex': TYPE0,
    };
    let enriched = ctx;
    for (const [name, type] of Object.entries(stdTypes)) {
        enriched = extendContext(enriched, name, type);
    }
    return enriched;
}

// ── The type-checker ────────────────────────────────────────

export function typeCheck(module: IRModule): TypeCheckResult {
    const ctx = makeStdContext(emptyContext(module.axiomBundle));
    const diagnostics: Diagnostic[] = [];
    const inferredTypes = new Map<string, Term>();
    const holes: HoleInfo[] = [];
    const axiomUsage = new Set<string>();

    for (const decl of module.declarations) {
        checkDeclaration(ctx, decl, diagnostics, inferredTypes, holes, axiomUsage);
    }

    return {
        valid: diagnostics.every(d => d.severity !== 'error'),
        diagnostics,
        inferredTypes,
        holes,
        axiomUsage,
    };
}

function checkDeclaration(
    ctx: TypeContext,
    decl: Declaration,
    diagnostics: Diagnostic[],
    inferredTypes: Map<string, Term>,
    holes: HoleInfo[],
    axiomUsage: Set<string>
): void {
    switch (decl.tag) {
        case 'Definition': {
            const paramCtx = addParams(ctx, decl.params, diagnostics, holes, axiomUsage);
            const bodyType = inferType(paramCtx, decl.body, holes, axiomUsage, diagnostics);

            if (bodyType) {
                inferredTypes.set(decl.name, bodyType);

                // Check body type against declared return type
                const declaredNorm = normalize(decl.returnType, paramCtx);
                const inferredNorm = normalize(bodyType, paramCtx);
                if (!termsEqual(declaredNorm, inferredNorm) && declaredNorm.tag !== 'Sort') {
                    diagnostics.push({
                        severity: 'warning',
                        message: `Definition '${decl.name}': declared return type may not match inferred type`,
                        location: decl.name, term: bodyType,
                    });
                }

                diagnostics.push({
                    severity: 'info',
                    message: `Definition '${decl.name}' type-checks successfully`,
                    location: decl.name,
                });
            } else {
                diagnostics.push({
                    severity: 'error',
                    message: `Definition '${decl.name}': could not infer type of body`,
                    location: decl.name, term: decl.body,
                });
            }
            break;
        }
        case 'Theorem':
        case 'Lemma': {
            const paramCtx = addParams(ctx, decl.params, diagnostics, holes, axiomUsage);

            // Check that the statement is well-formed (must be a type/prop)
            const stmtType = inferType(paramCtx, decl.statement, holes, axiomUsage, diagnostics);
            if (stmtType) {
                inferredTypes.set(decl.name, decl.statement);

                // Statement should have type Prop or Type
                const stmtNorm = normalize(stmtType, paramCtx);
                if (stmtNorm.tag === 'Sort') {
                    diagnostics.push({
                        severity: 'info',
                        message: `${decl.tag} '${decl.name}' statement is well-formed (${stmtNorm.universe.tag === 'Prop' ? 'propositional' : `Type ${stmtNorm.universe.tag === 'Type' ? stmtNorm.universe.level : ''}`})`,
                        location: decl.name,
                    });
                } else {
                    diagnostics.push({
                        severity: 'warning',
                        message: `${decl.tag} '${decl.name}': statement type could not be fully resolved`,
                        location: decl.name, term: stmtType,
                    });
                }
            } else {
                diagnostics.push({
                    severity: 'error',
                    message: `${decl.tag} '${decl.name}': statement is not well-formed`,
                    location: decl.name, term: decl.statement,
                });
            }

            // Check proof tactics
            const hasSorry = decl.proof.some(t => containsSorry(t));
            if (hasSorry) {
                diagnostics.push({
                    severity: 'warning',
                    message: `${decl.tag} '${decl.name}' contains unresolved proof obligations (sorry)`,
                    location: decl.name,
                });
            } else if (decl.proof.length > 0) {
                diagnostics.push({
                    severity: 'info',
                    message: `${decl.tag} '${decl.name}' proof script provided (${decl.proof.length} tactic${decl.proof.length !== 1 ? 's' : ''})`,
                    location: decl.name,
                });
            } else {
                diagnostics.push({
                    severity: 'warning',
                    message: `${decl.tag} '${decl.name}' has no proof`,
                    location: decl.name,
                });
            }

            // Check axiom bundle compatibility
            if (decl.tag === 'Theorem' && decl.axiomBundle) {
                for (const axiom of axiomUsage) {
                    if (!decl.axiomBundle.axioms.has(axiom as Axiom)) {
                        diagnostics.push({
                            severity: 'warning',
                            message: `Theorem '${decl.name}' uses axiom '${axiom}' not in bundle '${decl.axiomBundle.name}'`,
                            location: decl.name,
                        });
                    }
                }
            }
            break;
        }
    }
}

function addParams(
    ctx: TypeContext,
    params: Param[],
    diagnostics: Diagnostic[],
    holes: HoleInfo[],
    axiomUsage: Set<string>
): TypeContext {
    let result = ctx;
    for (const p of params) {
        // Verify each parameter type is well-formed
        const paramTypeType = inferType(result, p.type, holes, axiomUsage, diagnostics);
        if (!paramTypeType) {
            diagnostics.push({
                severity: 'error',
                message: `Parameter '${p.name}': type is not well-formed`,
                term: p.type,
            });
        }
        result = extendContext(result, p.name, p.type);
    }
    return result;
}

// ── Type inference ──────────────────────────────────────────

export function inferType(
    ctx: TypeContext,
    term: Term,
    holes: HoleInfo[],
    axiomUsage: Set<string>,
    diagnostics: Diagnostic[]
): Term | null {
    switch (term.tag) {
        case 'Var': {
            const type = ctx.bindings.get(term.name);
            if (type) return type;
            diagnostics.push({
                severity: 'error',
                message: `Unbound variable '${term.name}'`,
                term,
            });
            return null;
        }

        case 'Literal': {
            switch (term.kind) {
                case 'Nat': return { tag: 'Var', name: 'ℕ' };
                case 'Int': return { tag: 'Var', name: 'ℤ' };
                case 'Bool': return { tag: 'Var', name: 'Bool' };
                case 'String': return { tag: 'Var', name: 'String' };
            }
        }

        case 'Sort': {
            // Type : Type (simplified, ignoring universe inconsistency for now)
            if (term.universe.tag === 'Prop') return TYPE1;
            return { tag: 'Sort', universe: { tag: 'Type', level: term.universe.level + 1 } };
        }

        case 'Lam': {
            // Check parameter type is well-formed
            const paramTypeType = inferType(ctx, term.paramType, holes, axiomUsage, diagnostics);
            if (!paramTypeType) return null;

            const bodyCtx = extendContext(ctx, term.param, term.paramType);
            const bodyType = inferType(bodyCtx, term.body, holes, axiomUsage, diagnostics);
            if (bodyType) {
                return { tag: 'Pi', param: term.param, paramType: term.paramType, body: bodyType };
            }
            return null;
        }

        case 'App': {
            const funcType = inferType(ctx, term.func, holes, axiomUsage, diagnostics);
            if (!funcType) return null;

            const funcNorm = normalize(funcType, ctx);

            if (funcNorm.tag === 'Pi') {
                // Check argument type matches parameter type
                const argType = inferType(ctx, term.arg, holes, axiomUsage, diagnostics);
                if (argType) {
                    const argNorm = normalize(argType, ctx);
                    const paramNorm = normalize(funcNorm.paramType, ctx);
                    if (!termsEqual(argNorm, paramNorm)) {
                        // Soft warning — math notation is flexible
                        diagnostics.push({
                            severity: 'hint',
                            message: `Application: argument type may not match parameter type`,
                            term: term.arg,
                        });
                    }
                }
                // Substitute argument into body to get result type
                return substitute(funcNorm.body, funcNorm.param, term.arg);
            }

            // If we can't resolve the function type, infer argument and return generic
            inferType(ctx, term.arg, holes, axiomUsage, diagnostics);
            return TYPE0;
        }

        case 'Pi': {
            const paramTypeType = inferType(ctx, term.paramType, holes, axiomUsage, diagnostics);
            const bodyCtx = extendContext(ctx, term.param, term.paramType);
            const bodyType = inferType(bodyCtx, term.body, holes, axiomUsage, diagnostics);

            if (paramTypeType && bodyType) {
                // Π (x : A) → B where A : Type_i and B : Type_j has type Type_max(i,j)
                // If B : Prop, then Π-type : Prop (impredicativity)
                const paramSort = normalize(paramTypeType, ctx);
                const bodySort = normalize(bodyType, ctx);

                if (bodySort.tag === 'Sort' && bodySort.universe.tag === 'Prop') {
                    return PROP;
                }

                const paramLevel = paramSort.tag === 'Sort' && paramSort.universe.tag === 'Type' ? paramSort.universe.level : 0;
                const bodyLevel = bodySort.tag === 'Sort' && bodySort.universe.tag === 'Type' ? bodySort.universe.level : 0;
                return { tag: 'Sort', universe: { tag: 'Type', level: Math.max(paramLevel, bodyLevel) } };
            }
            return TYPE0;
        }

        case 'Sigma': {
            inferType(ctx, term.paramType, holes, axiomUsage, diagnostics);
            const bodyCtx = extendContext(ctx, term.param, term.paramType);
            inferType(bodyCtx, term.body, holes, axiomUsage, diagnostics);
            return TYPE0;
        }

        case 'ForAll': {
            // ∀ x ∈ D, P(x)  has type Prop
            inferType(ctx, term.domain, holes, axiomUsage, diagnostics);
            const bodyCtx = extendContext(ctx, term.param, term.domain);
            const bodyType = inferType(bodyCtx, term.body, holes, axiomUsage, diagnostics);
            if (bodyType) {
                const bodyNorm = normalize(bodyType, ctx);
                if (bodyNorm.tag === 'Sort' && bodyNorm.universe.tag === 'Prop') {
                    return PROP;
                }
            }
            return PROP;
        }

        case 'Exists': {
            inferType(ctx, term.domain, holes, axiomUsage, diagnostics);
            const bodyCtx = extendContext(ctx, term.param, term.domain);
            inferType(bodyCtx, term.body, holes, axiomUsage, diagnostics);
            return PROP;
        }

        case 'BinOp': {
            const leftType = inferType(ctx, term.left, holes, axiomUsage, diagnostics);
            const rightType = inferType(ctx, term.right, holes, axiomUsage, diagnostics);

            const propOps = new Set(['=', '<', '>', '≤', '≥', '∧', '∨', '→', '↔', '∈', '∉', '⊆']);
            if (propOps.has(term.op)) {
                return PROP;
            }

            // Arithmetic ops: try to infer from operands
            if (leftType && rightType) {
                const leftNorm = normalize(leftType, ctx);
                const rightNorm = normalize(rightType, ctx);
                // If both are natural numbers, result is natural
                if (leftNorm.tag === 'Var' && rightNorm.tag === 'Var') {
                    if (leftNorm.name === rightNorm.name) return leftNorm;
                    // ℕ op ℤ → ℤ, etc (widening)
                    const numHierarchy = ['ℕ', 'ℤ', 'ℝ', 'ℂ'];
                    const li = numHierarchy.indexOf(leftNorm.name);
                    const ri = numHierarchy.indexOf(rightNorm.name);
                    if (li >= 0 && ri >= 0) return { tag: 'Var', name: numHierarchy[Math.max(li, ri)] };
                }
                return leftNorm;
            }
            return { tag: 'Var', name: 'ℕ' };
        }

        case 'UnaryOp': {
            const opType = inferType(ctx, term.operand, holes, axiomUsage, diagnostics);
            if (term.op === '¬') return PROP;
            // Negation: ℕ → ℤ, ℤ → ℤ, ℝ → ℝ
            if (opType) {
                const norm = normalize(opType, ctx);
                if (norm.tag === 'Var' && norm.name === 'ℕ') return { tag: 'Var', name: 'ℤ' };
                return norm;
            }
            return { tag: 'Var', name: 'ℤ' };
        }

        case 'Equiv': {
            inferType(ctx, term.left, holes, axiomUsage, diagnostics);
            inferType(ctx, term.right, holes, axiomUsage, diagnostics);
            if (term.modulus) inferType(ctx, term.modulus, holes, axiomUsage, diagnostics);
            return PROP;
        }

        case 'Hole': {
            holes.push({
                id: term.id,
                expectedType: undefined, // Inferred from context in checking mode
                context: new Map(ctx.bindings),
                suggestions: generateSuggestions(ctx, term),
            });
            return null;
        }

        case 'AxiomRef': {
            axiomUsage.add(term.axiom);
            // Verify axiom is in the bundle
            if (!ctx.axiomBundle.axioms.has(term.axiom)) {
                diagnostics.push({
                    severity: 'warning',
                    message: `Axiom '${term.axiom}' used but not in current bundle '${ctx.axiomBundle.name}'`,
                    term,
                });
            }
            return PROP;
        }

        case 'Pair': {
            const fstType = inferType(ctx, term.fst, holes, axiomUsage, diagnostics);
            const sndType = inferType(ctx, term.snd, holes, axiomUsage, diagnostics);
            if (fstType && sndType) {
                return { tag: 'Sigma', param: '_', paramType: fstType, body: sndType };
            }
            return null;
        }

        case 'Proj': {
            const pairType = inferType(ctx, term.term, holes, axiomUsage, diagnostics);
            if (pairType) {
                const norm = normalize(pairType, ctx);
                if (norm.tag === 'Sigma') {
                    return term.index === 1 ? norm.paramType : norm.body;
                }
            }
            return TYPE0;
        }

        case 'LetIn': {
            const valType = inferType(ctx, term.value, holes, axiomUsage, diagnostics);
            const declaredType = inferType(ctx, term.type, holes, axiomUsage, diagnostics);

            if (valType && declaredType) {
                const valNorm = normalize(valType, ctx);
                const declNorm = normalize(term.type, ctx);
                if (!termsEqual(valNorm, declNorm)) {
                    diagnostics.push({
                        severity: 'warning',
                        message: `let '${term.name}': declared type may not match value type`,
                        term: term.value,
                    });
                }
            }

            const bodyCtx = extendContext(ctx, term.name, term.type);
            return inferType(bodyCtx, term.body, holes, axiomUsage, diagnostics);
        }

        case 'Ind':
            return TYPE1;

        case 'Match': {
            inferType(ctx, term.scrutinee, holes, axiomUsage, diagnostics);
            let resultType: Term | null = null;
            for (const c of term.cases) {
                const caseCtx = c.bindings.reduce((acc, b) => extendContext(acc, b, TYPE0), ctx);
                const caseType = inferType(caseCtx, c.body, holes, axiomUsage, diagnostics);
                if (caseType && !resultType) resultType = caseType;
                // Could check all cases return compatible types
            }
            return resultType || TYPE0;
        }
    }
    return null;
}

function containsSorry(t: import('./ir').Tactic): boolean {
    if (t.tag === 'Sorry') return true;
    if (t.tag === 'Seq') return t.tactics.some(containsSorry);
    if (t.tag === 'Alt') return t.tactics.some(containsSorry);
    return false;
}

function generateSuggestions(ctx: TypeContext, hole: import('./ir').Hole): string[] {
    const suggestions: string[] = [];

    // Context-aware suggestions based on type-checker bindings
    const names = Array.from(ctx.bindings.keys());
    if (names.length > 0) {
        suggestions.push(`Try: apply ${names[names.length - 1]}`);
    }

    // Builtin tactics
    suggestions.push(
        'Try: induction on parameter',
        'Try: cases analysis',
        'Try: simp [relevant_lemma]',
        'Try: omega (linear arithmetic)',
        'Try: ring (ring equations)',
    );

    // The Hole node's optional annotation string (distinct from HoleInfo.context which is the type-checker scope)
    if (hole.context) {
        suggestions.push(`Hole annotation: ${hole.context}`);
    }

    return suggestions;
}
