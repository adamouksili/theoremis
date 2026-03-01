// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Math-AST (Document-Level Abstract Syntax Tree)
// ─────────────────────────────────────────────────────────────

import type { Term, Tactic } from '../core/ir';

// ── Document-level AST nodes ────────────────────────────────

export type MathNode =
    | DefNode
    | ThmNode
    | LemmaNode
    | ProofNode
    | RemarkNode
    | ExampleNode
    | SectionNode
    | RefNode;

export interface DefNode {
    tag: 'DefNode';
    name: string;
    params: ParamDecl[];
    body: Term | null;
    rawLatex: string;
    line: number;
}

export interface ThmNode {
    tag: 'ThmNode';
    name: string;
    label: string;
    hypotheses: HypothesisDecl[];
    conclusion: Term;
    proof: ProofNode | null;
    rawLatex: string;
    line: number;
}

export interface LemmaNode {
    tag: 'LemmaNode';
    name: string;
    label: string;
    hypotheses: HypothesisDecl[];
    conclusion: Term;
    proof: ProofNode | null;
    rawLatex: string;
    line: number;
}

export interface ProofNode {
    tag: 'ProofNode';
    tactics: Tactic[];
    rawLatex: string;
    strategy: string;
    line: number;
}

export interface RemarkNode {
    tag: 'RemarkNode';
    content: string;
    line: number;
}

export interface ExampleNode {
    tag: 'ExampleNode';
    content: string;
    line: number;
}

export interface SectionNode {
    tag: 'SectionNode';
    title: string;
    children: MathNode[];
    line: number;
}

export interface RefNode {
    tag: 'RefNode';
    target: string;
    kind: 'theorem' | 'lemma' | 'definition' | 'equation';
    line: number;
}

// ── Supporting types ────────────────────────────────────────

export interface ParamDecl {
    name: string;
    type: Term;
    description: string;
}

export interface HypothesisDecl {
    name: string;
    condition: Term;
    description: string;
}

// ── Document ────────────────────────────────────────────────

export interface MathDocument {
    title: string;
    nodes: MathNode[];
    dependencies: DependencyEdge[];
    rawSource: string;
    parseErrors?: ParseError[];
}

export interface ParseError {
    message: string;
    line: number;
    column: number;
    length?: number;
}

export interface DependencyEdge {
    from: string;
    to: string;
    kind: 'uses' | 'extends' | 'generalizes';
}
