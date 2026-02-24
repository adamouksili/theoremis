// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Assumption Mutator
// Generates theorem variants by mutating hypotheses
// ─────────────────────────────────────────────────────────────

import type { Term, Theorem, Param } from '../core/ir';
import { mk, Types } from '../core/ir';

export type MutationType =
    | 'drop_hypothesis' | 'weaken_condition' | 'swap_quantifier'
    | 'perturb_constant' | 'change_domain' | 'negate_conclusion' | 'strengthen_conclusion';

export interface Mutation {
    type: MutationType;
    description: string;
    original: Term;
    mutated: Term;
    params: Param[];
    droppedParam?: string;
}

export function generateMutations(theorem: Theorem): Mutation[] {
    const mutations: Mutation[] = [];

    // Drop each hypothesis
    for (let i = 0; i < theorem.params.length; i++) {
        const param = theorem.params[i];
        mutations.push({
            type: 'drop_hypothesis',
            description: `Drop hypothesis: ${param.name}`,
            original: theorem.statement,
            mutated: theorem.statement,
            params: theorem.params.filter((_, j) => j !== i),
            droppedParam: param.name,
        });
    }

    // Weaken conditions
    for (const w of weakenTerm(theorem.statement)) {
        mutations.push({ type: 'weaken_condition', ...w, original: theorem.statement, params: theorem.params });
    }

    // Swap quantifiers
    const swapped = swapQuantifiers(theorem.statement);
    if (swapped) {
        mutations.push({ type: 'swap_quantifier', description: 'Swap ∀/∃', original: theorem.statement, mutated: swapped, params: theorem.params });
    }

    // Change domains
    for (const d of changeDomains(theorem.statement)) {
        mutations.push({ type: 'change_domain', ...d, original: theorem.statement, params: theorem.params });
    }

    // Negate conclusion
    mutations.push({ type: 'negate_conclusion', description: 'Negate conclusion', original: theorem.statement, mutated: mk.unaryOp('¬', theorem.statement), params: theorem.params });

    // Strengthen
    for (const s of strengthenConclusion(theorem.statement)) {
        mutations.push({ type: 'strengthen_conclusion', ...s, original: theorem.statement, params: theorem.params });
    }

    return mutations;
}

function weakenTerm(term: Term): Array<{ mutated: Term; description: string }> {
    const r: Array<{ mutated: Term; description: string }> = [];
    if (term.tag === 'BinOp') {
        if (term.op === '=') {
            r.push({ mutated: mk.binOp('≥', term.left, term.right), description: 'Weaken = to ≥' });
            r.push({ mutated: mk.binOp('≤', term.left, term.right), description: 'Weaken = to ≤' });
        }
        if (term.op === '↔') {
            r.push({ mutated: mk.binOp('→', term.left, term.right), description: 'Weaken ↔ to → (forward)' });
            r.push({ mutated: mk.binOp('→', term.right, term.left), description: 'Weaken ↔ to ← (backward)' });
        }
    }
    if (term.tag === 'ForAll') {
        for (const w of weakenTerm(term.body)) r.push({ mutated: mk.forAll(term.param, term.domain, w.mutated), description: w.description });
    }
    return r;
}

function swapQuantifiers(t: Term): Term | null {
    if (t.tag === 'ForAll') return mk.exists(t.param, t.domain, t.body);
    if (t.tag === 'Exists') return mk.forAll(t.param, t.domain, t.body);
    return null;
}

function changeDomains(term: Term): Array<{ mutated: Term; description: string }> {
    const r: Array<{ mutated: Term; description: string }> = [];
    const alts: Array<[string, Term, string]> = [['ℕ', Types.Int, 'ℤ'], ['ℤ', Types.Real, 'ℝ'], ['ℝ', Types.Complex, 'ℂ'], ['ℕ', Types.Real, 'ℝ']];
    if ((term.tag === 'ForAll' || term.tag === 'Exists') && term.domain.tag === 'Var') {
        for (const [from, to, label] of alts) {
            if (term.domain.name === from) {
                const newT = term.tag === 'ForAll' ? mk.forAll(term.param, to, term.body) : mk.exists(term.param, to, term.body);
                r.push({ mutated: newT, description: `Change domain ${from} → ${label}` });
            }
        }
    }
    return r;
}

function strengthenConclusion(term: Term): Array<{ mutated: Term; description: string }> {
    const r: Array<{ mutated: Term; description: string }> = [];
    if (term.tag === 'BinOp') {
        if (term.op === '≥') r.push({ mutated: mk.binOp('>', term.left, term.right), description: 'Strengthen ≥ to >' });
        if (term.op === '≤') r.push({ mutated: mk.binOp('<', term.left, term.right), description: 'Strengthen ≤ to <' });
    }
    if (term.tag === 'ForAll') {
        for (const s of strengthenConclusion(term.body)) r.push({ mutated: mk.forAll(term.param, term.domain, s.mutated), description: s.description });
    }
    return r;
}
