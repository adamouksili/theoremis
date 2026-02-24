// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Pretty-Printer for λΠω IR Terms
// ─────────────────────────────────────────────────────────────

import type { Term, Tactic, Declaration, IRModule, Param } from './ir';

// ── Pretty-print a term in mathematical notation ────────────

export function prettyTerm(term: Term, indent: number = 0): string {
    const pad = '  '.repeat(indent);

    switch (term.tag) {
        case 'Var': return term.name;

        case 'Literal':
            return term.value;

        case 'Lam':
            return `λ (${term.param} : ${prettyTerm(term.paramType)}) ⇒ ${prettyTerm(term.body)}`;

        case 'App':
            return `(${prettyTerm(term.func)} ${prettyTerm(term.arg)})`;

        case 'Pi':
            if (term.param === '_') {
                return `${prettyTerm(term.paramType)} → ${prettyTerm(term.body)}`;
            }
            return `Π (${term.param} : ${prettyTerm(term.paramType)}), ${prettyTerm(term.body)}`;

        case 'Sigma':
            return `Σ (${term.param} : ${prettyTerm(term.paramType)}), ${prettyTerm(term.body)}`;

        case 'Pair':
            return `⟨${prettyTerm(term.fst)}, ${prettyTerm(term.snd)}⟩`;

        case 'Proj':
            return `${prettyTerm(term.term)}.${term.index}`;

        case 'LetIn':
            return `${pad}let ${term.name} : ${prettyTerm(term.type)} := ${prettyTerm(term.value)} in\n${prettyTerm(term.body, indent)}`;

        case 'Sort':
            return term.universe.tag === 'Prop' ? 'Prop' : `Type ${term.universe.level}`;

        case 'Ind':
            return `inductive ${term.name} : ${prettyTerm(term.type)} where\n` +
                term.constructors.map(c => `${pad}  | ${c.name} : ${prettyTerm(c.type)}`).join('\n');

        case 'Match':
            return `match ${prettyTerm(term.scrutinee)} with\n` +
                term.cases.map(c => `${pad}  | ${c.pattern}${c.bindings.length ? ' ' + c.bindings.join(' ') : ''} => ${prettyTerm(c.body)}`).join('\n');

        case 'Hole':
            return `?${term.id}`;

        case 'AxiomRef':
            return `axiom[${term.axiom}]`;

        case 'BinOp':
            return `(${prettyTerm(term.left)} ${term.op} ${prettyTerm(term.right)})`;

        case 'UnaryOp':
            return `(${term.op}${prettyTerm(term.operand)})`;

        case 'Equiv':
            if (term.modulus) {
                return `${prettyTerm(term.left)} ≡ ${prettyTerm(term.right)} [MOD ${prettyTerm(term.modulus)}]`;
            }
            return `${prettyTerm(term.left)} ≡ ${prettyTerm(term.right)}`;

        case 'ForAll':
            return `∀ ${term.param} ∈ ${prettyTerm(term.domain)}, ${prettyTerm(term.body)}`;

        case 'Exists':
            return `∃ ${term.param} ∈ ${prettyTerm(term.domain)}, ${prettyTerm(term.body)}`;
    }
}

// ── Pretty-print a tactic ───────────────────────────────────

export function prettyTactic(tactic: Tactic, indent: number = 0): string {
    const pad = '  '.repeat(indent);
    switch (tactic.tag) {
        case 'Intro':
            return `${pad}intro ${tactic.names.join(' ')}`;
        case 'Apply':
            return `${pad}apply ${prettyTerm(tactic.term)}`;
        case 'Rewrite':
            return `${pad}rw [${tactic.direction === 'rtl' ? '← ' : ''}${prettyTerm(tactic.term)}]`;
        case 'Induction':
            return `${pad}induction ${tactic.name}`;
        case 'Cases':
            return `${pad}cases ${prettyTerm(tactic.term)}`;
        case 'Simp':
            return `${pad}simp${tactic.lemmas.length > 0 ? ' [' + tactic.lemmas.join(', ') + ']' : ''}`;
        case 'Omega':
            return `${pad}omega`;
        case 'Sorry':
            return `${pad}sorry`;
        case 'Auto':
            return `${pad}auto ${tactic.depth}`;
        case 'Seq':
            return tactic.tactics.map(t => prettyTactic(t, indent)).join('\n');
        case 'Alt':
            return tactic.tactics.map(t => prettyTactic(t, indent)).join(' <|> ');
        case 'Exact':
            return `${pad}exact ${prettyTerm(tactic.term)}`;
        case 'Ring':
            return `${pad}ring`;
        case 'LLMSuggest':
            return `${pad}-- LLM suggestion: ${tactic.context}`;
    }
}

// ── Pretty-print a parameter list ───────────────────────────

function prettyParams(params: Param[]): string {
    return params.map(p => {
        const wrap = p.implicit ? ['{', '}'] : ['(', ')'];
        return `${wrap[0]}${p.name} : ${prettyTerm(p.type)}${wrap[1]}`;
    }).join(' ');
}

// ── Pretty-print a declaration ──────────────────────────────

export function prettyDeclaration(decl: Declaration): string {
    switch (decl.tag) {
        case 'Definition':
            return `def ${decl.name} ${prettyParams(decl.params)} : ${prettyTerm(decl.returnType)} :=\n  ${prettyTerm(decl.body, 1)}`;

        case 'Theorem':
        case 'Lemma': {
            const keyword = decl.tag === 'Theorem' ? 'theorem' : 'lemma';
            const proofBlock = decl.proof.length > 0
                ? ' := by\n' + decl.proof.map(t => prettyTactic(t, 1)).join('\n')
                : ' := by\n  sorry';
            return `${keyword} ${decl.name} ${prettyParams(decl.params)} :\n  ${prettyTerm(decl.statement)}${proofBlock}`;
        }
    }
}

// ── Pretty-print a full module ──────────────────────────────

export function prettyModule(mod: IRModule): string {
    const header = `-- Module: ${mod.name}\n-- Axiom Bundle: ${mod.axiomBundle.name}\n-- Axioms: ${[...mod.axiomBundle.axioms].join(', ') || '(none)'}\n`;
    const imports = mod.imports.length > 0
        ? '\n' + mod.imports.map(i => `import ${i}`).join('\n') + '\n'
        : '';
    const body = mod.declarations.map(prettyDeclaration).join('\n\n');
    return `${header}${imports}\n${body}\n`;
}
