// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Discourse-Level Analysis
// Identifies rhetorical roles and builds dependency graphs
// ─────────────────────────────────────────────────────────────

import type { MathDocument, DependencyEdge, MathNode } from './ast';

// ── Discourse roles ─────────────────────────────────────────

export type DiscourseRole =
    | 'definition'
    | 'axiom'
    | 'theorem'
    | 'lemma'
    | 'corollary'
    | 'proposition'
    | 'proof'
    | 'remark'
    | 'example'
    | 'conjecture'
    | 'notation';

export interface DiscourseBlock {
    role: DiscourseRole;
    name: string;
    startLine: number;
    endLine: number;
    content: string;
    references: string[];
}

// ── Analyze discourse structure ─────────────────────────────

export function analyzeDiscourse(source: string): DiscourseBlock[] {
    const blocks: DiscourseBlock[] = [];
    const lines = source.split('\n');

    const envPatterns: Array<{ pattern: RegExp; role: DiscourseRole; endPattern: RegExp }> = [
        { pattern: /\\begin\{theorem\}/, role: 'theorem', endPattern: /\\end\{theorem\}/ },
        { pattern: /\\begin\{thm\}/, role: 'theorem', endPattern: /\\end\{thm\}/ },
        { pattern: /\\begin\{lemma\}/, role: 'lemma', endPattern: /\\end\{lemma\}/ },
        { pattern: /\\begin\{lem\}/, role: 'lemma', endPattern: /\\end\{lem\}/ },
        { pattern: /\\begin\{definition\}/, role: 'definition', endPattern: /\\end\{definition\}/ },
        { pattern: /\\begin\{defn\}/, role: 'definition', endPattern: /\\end\{defn\}/ },
        { pattern: /\\begin\{proof\}/, role: 'proof', endPattern: /\\end\{proof\}/ },
        { pattern: /\\begin\{corollary\}/, role: 'corollary', endPattern: /\\end\{corollary\}/ },
        { pattern: /\\begin\{proposition\}/, role: 'proposition', endPattern: /\\end\{proposition\}/ },
        { pattern: /\\begin\{remark\}/, role: 'remark', endPattern: /\\end\{remark\}/ },
        { pattern: /\\begin\{example\}/, role: 'example', endPattern: /\\end\{example\}/ },
        { pattern: /\\begin\{conjecture\}/, role: 'conjecture', endPattern: /\\end\{conjecture\}/ },
    ];

    let i = 0;
    while (i < lines.length) {
        let matched = false;
        for (const { pattern, role, endPattern } of envPatterns) {
            if (pattern.test(lines[i])) {
                const startLine = i;
                const contentLines: string[] = [];
                i++;
                while (i < lines.length && !endPattern.test(lines[i])) {
                    contentLines.push(lines[i]);
                    i++;
                }
                const content = contentLines.join('\n');
                const nameMatch = lines[startLine].match(/\[([^\]]+)\]/) || content.match(/\\label\{([^}]+)\}/);
                const references = extractAllReferences(content);

                blocks.push({
                    role,
                    name: nameMatch?.[1] ?? `${role}_${startLine}`,
                    startLine,
                    endLine: i,
                    content,
                    references,
                });
                matched = true;
                break;
            }
        }
        if (!matched) i++;
    }

    return blocks;
}

// ── Build dependency graph from discourse blocks ────────────

export function buildDependencyGraph(doc: MathDocument): DependencyGraph {
    const nodes = new Map<string, GraphNode>();
    const edges: DependencyEdge[] = [...doc.dependencies];

    for (const node of doc.nodes) {
        const name = getNodeName(node);
        nodes.set(name, {
            id: name,
            label: name,
            kind: node.tag === 'ThmNode' ? 'theorem'
                : node.tag === 'LemmaNode' ? 'lemma'
                    : node.tag === 'DefNode' ? 'definition'
                        : 'other',
            status: getNodeStatus(node),
            line: node.line,
        });
    }

    return { nodes, edges };
}

export interface DependencyGraph {
    nodes: Map<string, GraphNode>;
    edges: DependencyEdge[];
}

export interface GraphNode {
    id: string;
    label: string;
    kind: 'theorem' | 'lemma' | 'definition' | 'other';
    status: 'verified' | 'partial' | 'unverified';
    line: number;
}

// ── Utilities ───────────────────────────────────────────────

function extractAllReferences(text: string): string[] {
    const refs: string[] = [];
    const patterns = [
        /\\ref\{([^}]+)\}/g,
        /\\eqref\{([^}]+)\}/g,
        /\\cite\{([^}]+)\}/g,
        /Theorem\s+(\d+(?:\.\d+)*)/g,
        /Lemma\s+(\d+(?:\.\d+)*)/g,
        /Definition\s+(\d+(?:\.\d+)*)/g,
        /by\s+(?:the\s+)?(?:previous\s+)?(?:above\s+)?(theorem|lemma|definition|proposition)/gi,
    ];

    for (const pattern of patterns) {
        for (const match of text.matchAll(pattern)) {
            refs.push(match[1]);
        }
    }

    return refs;
}

function getNodeName(node: MathNode): string {
    switch (node.tag) {
        case 'ThmNode':
        case 'LemmaNode':
            return node.name;
        case 'DefNode':
            return node.name;
        default:
            return `node_${node.line}`;
    }
}

function getNodeStatus(node: MathNode): 'verified' | 'partial' | 'unverified' {
    if (node.tag === 'ThmNode' || node.tag === 'LemmaNode') {
        if (!node.proof) return 'unverified';
        const hasSorry = node.proof.tactics.some(t => t.tag === 'Sorry');
        return hasSorry ? 'partial' : 'verified';
    }
    return 'verified';
}
