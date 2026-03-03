import { parseLatex, documentToIR } from '../parser/latex';
import { resolveMultiFile, InMemoryFileProvider } from '../parser/multifile';
import { refineDocWithLLM } from '../parser/llm-hypothesis';
import { typeCheck } from '../core/typechecker';
import { emitLean4 } from '../emitters/lean4';
import { emitCoq } from '../emitters/coq';
import { emitIsabelle } from '../emitters/isabelle';
import { runCounterexampleEngine } from '../engine/counterexample';
import { quickCheck, extractVariables } from '../engine/evaluator';
import { GraphRenderer } from './graph';
import type { Theorem } from '../core/ir';

import { $, S } from './state';
import { renderSummary } from './render/summary';
import { renderCodeSection } from './render/code';
import { renderInsights, renderRandomTests } from './render/insights';
import { renderProofSteps } from './render/proof-steps';
import { renderMathlibSearch } from './render/mathlib-search';
import { getActiveAxioms, buildAxiomBundle, renderDepGraph } from './render/axioms';
import { renderKaTeXPreview } from './layout-shell';
import { iconCheck, iconWarn } from './icons';

export type StatusMode = 'idle' | 'processing' | 'done';

export interface IdePipelineController {
    run: () => Promise<void>;
    debouncedRun: () => void;
    setStatus: (mode: StatusMode, label: string) => void;
    clearResults: () => void;
    downloadOutput: () => void;
    loadSample: () => void;
}

let graphRenderer: GraphRenderer | null = null;

function renderDependencyGraph() {
    if (!S.ir) return;
    const container = document.getElementById('graph-container');
    if (!container) return;

    const nodeMap = new Map<string, import('../parser/discourse').GraphNode>();
    for (const decl of S.ir.declarations) {
        const hasError = S.tc?.diagnostics.some(d => d.location === decl.name && d.severity === 'error');
        const hasWarning = S.tc?.diagnostics.some(d => d.location === decl.name && d.severity === 'warning');
        nodeMap.set(decl.name, {
            id: decl.name,
            label: decl.name,
            kind: decl.tag === 'Theorem' ? 'theorem' : decl.tag === 'Lemma' ? 'lemma' : 'definition',
            status: hasError ? 'unverified' : hasWarning ? 'partial' : 'verified',
            line: 0,
        });
    }

    const edges: import('../parser/ast').DependencyEdge[] = [];
    for (const decl of S.ir.declarations) {
        if (decl.tag === 'Theorem' && decl.metadata?.dependencies) {
            for (const dep of decl.metadata.dependencies) {
                edges.push({ from: decl.name, to: dep, kind: 'uses' });
            }
        }
    }

    if (!graphRenderer) {
        container.innerHTML = '';
        container.style.minHeight = '120px';
        graphRenderer = new GraphRenderer(container);
    }
    graphRenderer.render({ nodes: nodeMap, edges });
}

function renderBottomPanels() {
    $('bottom-panels').style.display = 'flex';
    renderInsights();
    renderRandomTests();
    renderProofSteps();
    renderMathlibSearch();
}

function renderAll(setStatus: (mode: StatusMode, label: string) => void) {
    const dc = S.ir!.declarations.length;
    if (dc === 0) {
        renderSummary('warn', '—', 'No mathematical statements found', 'Add \\begin{theorem} or \\begin{definition} environments');
        $('code-section').style.display = 'none';
        $('bottom-panels').style.display = 'none';
        setStatus('done', 'No statements');
        $('s-stats').textContent = '';
        renderDepGraph();
        return;
    }

    const hasErrs = S.tc!.diagnostics.some(d => d.severity === 'error');
    renderSummary(
        hasErrs ? 'warn' : 'ok',
        hasErrs ? iconWarn : iconCheck,
        hasErrs ? 'Needs attention' : 'Successfully formalized',
        `${dc} statement${dc > 1 ? 's' : ''} processed`,
    );

    renderCodeSection();
    renderBottomPanels();
    renderDepGraph();

    setStatus('done', 'Verified');
    const h = S.tc!.holes.length;
    $('s-stats').textContent = `${dc} result${dc > 1 ? 's' : ''} · ${h} hole${h !== 1 ? 's' : ''} · ${getActiveAxioms().length} axioms`;
}

function setStatus(mode: StatusMode, label: string) {
    $('s-dot').className = 'status-dot' + (mode === 'processing' ? ' processing' : mode === 'done' ? ' active' : '');
    $('s-label').textContent = label;
}

function clearResults() {
    S.ir = null; S.tc = null; S.lean4 = null; S.coq = null; S.isabelle = null;
    S.report = null; S.randomReport = null; S.status = 'idle';
    renderSummary('idle', '∑', 'Ready', 'Write LaTeX on the left to begin');
    $('code-section').style.display = 'none';
    $('bottom-panels').style.display = 'none';
    setStatus('idle', 'Ready');
    $('s-stats').textContent = '';
    $('dep-graph').innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">No declarations</div>';
}

function downloadOutput() {
    let content: string;
    let filename: string;

    if (S.tab === 'lean4' && S.lean4) {
        content = S.lean4.code;
        filename = 'output.lean';
    } else if (S.tab === 'coq' && S.coq) {
        content = S.coq.code;
        filename = 'output.v';
    } else if (S.tab === 'isabelle' && S.isabelle) {
        content = S.isabelle.code;
        filename = 'output.thy';
    } else if (S.source.trim()) {
        content = S.source;
        filename = 'document.tex';
    } else {
        return;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function loadSample(run: () => Promise<void>) {
    const sample = `\\title{Elementary Number Theory}

\\begin{definition}[Prime Number]
A natural number $p > 1$ is \\emph{prime} if its only divisors are $1$ and $p$.
\\end{definition}

\\begin{theorem}[Fermat's Little Theorem]
Let $p$ be a prime number and $a$ an integer coprime to $p$.
Then $a^{p-1} \\equiv 1 \\pmod{p}$.
\\end{theorem}

\\begin{proof}
We proceed by induction on $a$. Consider the set $\\{1, 2, \\ldots, p-1\\}$.
Since $a$ is coprime to $p$, multiplication by $a$ modulo $p$ is a bijection
on this set. Therefore the product of all elements is preserved, giving us
$(p-1)! \\equiv a^{p-1} \\cdot (p-1)! \\pmod{p}$.
By cancellation (using that $p$ is prime), we obtain $a^{p-1} \\equiv 1 \\pmod{p}$.
\\end{proof}

\\begin{lemma}[Squares are Non-negative]
For all $x \\in \\mathbb{R}$, $x^2 \\geq 0$.
\\end{lemma}

\\begin{proof}
By cases on the sign of $x$.
\\end{proof}`;

    const ed = $<HTMLTextAreaElement>('editor');
    ed.value = sample;
    S.source = sample;
    void run();
}

export function createPipelineController(): IdePipelineController {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
        const src = S.source.trim();
        if (!src || !src.includes('\\begin{')) {
            clearResults();
            return;
        }

        setStatus('processing', 'Compiling…');
        const verifyBtn = $('btn-verify');
        verifyBtn.innerHTML = '<span class="spinner"></span> Processing…';
        verifyBtn.setAttribute('disabled', 'true');

        try {
            const resolved = await resolveMultiFile(S.source, new InMemoryFileProvider());
            const doc = parseLatex(resolved.source);

            if (doc.parseErrors && doc.parseErrors.length > 0) {
                console.warn(`[Parser] ${doc.parseErrors.length} parse warning(s):`, doc.parseErrors.map(e => e.message));
            }

            const apiKey = sessionStorage.getItem('sigma-llm-key');
            const { refined } = await refineDocWithLLM(doc, apiKey);
            if (refined > 0) console.log(`[LLM] Refined ${refined} theorem(s) via LLM hypothesis parser`);

            const axiomBundle = buildAxiomBundle();
            S.ir = documentToIR(doc, axiomBundle);
            S.tc = typeCheck(S.ir);
            S.lean4 = emitLean4(S.ir);
            S.coq = emitCoq(S.ir);
            S.isabelle = emitIsabelle(S.ir);

            const theorems = S.ir.declarations.filter(d => d.tag === 'Theorem') as Theorem[];
            if (theorems.length > 0) {
                const reports = await Promise.all(theorems.map(t => runCounterexampleEngine(t)));
                S.report = reports[0];

                if (reports.length > 1) {
                    for (let i = 1; i < reports.length; i++) {
                        S.report.results.push(...reports[i].results);
                        S.report.summary += ' | ' + reports[i].summary;
                    }
                }

                S.randomReport = null;
                for (const thm of theorems) {
                    const vars = extractVariables(thm.statement);
                    if (vars.length > 0) {
                        const rr = quickCheck(thm.statement, vars, 5000, thm.params);
                        if (!S.randomReport || rr.failed > 0) {
                            S.randomReport = rr;
                        }
                    }
                }
            } else {
                S.report = null;
                S.randomReport = null;
            }

            S.status = 'done';
            renderDependencyGraph();
            renderKaTeXPreview(S.source);
            renderAll(setStatus);
            verifyBtn.innerHTML = `${iconCheck} Verify`;
            verifyBtn.removeAttribute('disabled');
        } catch (e: unknown) {
            S.ir = null; S.tc = null; S.lean4 = null; S.coq = null; S.isabelle = null;
            S.report = null; S.randomReport = null;
            renderSummary('warn', iconWarn, 'Could not parse input', 'Check your LaTeX syntax');
            setStatus('idle', 'Parse error');
            verifyBtn.innerHTML = `${iconCheck} Verify`;
            verifyBtn.removeAttribute('disabled');
            console.error(e);
        }
    };

    const debouncedRun = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void run(), 500);
    };

    return {
        run,
        debouncedRun,
        setStatus,
        clearResults,
        downloadOutput,
        loadSample: () => loadSample(run),
    };
}
