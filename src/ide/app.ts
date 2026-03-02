// ─────────────────────────────────────────────────────────────
// Theoremis  ·  IDE Application Shell
// Orchestrates modules: state, rendering, pipeline, bindings
// ─────────────────────────────────────────────────────────────

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
import { checkBridgeHealth, verifyLeanCode, formatLeanDiagnostics } from '../bridge/lean-client';
import { exportAnnotatedLaTeX } from '../emitters/annotated-latex';
import type { Theorem } from '../core/ir';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ── Shared state & helpers (single source of truth) ─────────
import { $, esc, S } from './state';

// ── Render modules ──────────────────────────────────────────
import { renderSummary } from './render/summary';
import { renderCodeSection } from './render/code';
import { renderInsights, renderRandomTests } from './render/insights';
import { renderProofSteps } from './render/proof-steps';
import { renderAxiomBudget, getActiveAxioms, buildAxiomBundle, renderDepGraph, setRunCallback } from './render/axioms';
import { iconMoon, iconSun, iconCheck, iconWarn, iconShieldCheck } from './icons';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ── Init ────────────────────────────────────────────────────

export function initApp() {
  document.getElementById('app')!.innerHTML = shell();
  bind();
  loadSample();
}

// ── Shell HTML ──────────────────────────────────────────────

function shell(): string {
  return `
<nav class="nav">
  <div class="nav-brand">
    <div class="nav-logo"><span>θ</span>Theoremis</div>
    <div class="nav-subtitle">Proof Verification IDE</div>
  </div>
  <div class="nav-actions">
    <input type="password" id="llm-key" placeholder="API Key (OpenAI / Anthropic / GitHub)" style="width:160px; font-size:11px; padding:4px 8px; border-radius:4px; border:1px solid var(--border); background:var(--bg-inset); color:var(--text)" title="API key is stored in session memory only. Supports OpenAI (sk-...), Anthropic (sk-ant-...), and GitHub PAT (ghp_...)">
    <select id="llm-model" style="font-size:11px; padding:4px 6px; border-radius:4px; border:1px solid var(--border); background:var(--bg-inset); color:var(--text)" title="LLM model selection">
      <option value="auto">Auto-detect</option>
      <option value="gpt-4o-mini">GPT-4o Mini</option>
      <option value="gpt-4o">GPT-4o</option>
      <option value="claude-sonnet-4-20250514">Claude Sonnet</option>
      <option value="claude-haiku-3-5">Claude Haiku</option>
    </select>
    <button class="btn icon-btn" id="btn-dark" title="Toggle dark mode">${iconMoon}</button>
    <div class="bridge-status" id="bridge-status" title="Lean 4 Bridge: checking..."><span class="bridge-dot offline"></span><span class="bridge-label">Bridge</span></div>
    <label class="btn" id="btn-upload" title="Upload .tex file"><input type="file" id="file-input" accept=".tex,.txt,.latex" style="display:none">Upload .tex</label>
    <button class="btn" id="btn-download" title="Download output">Download</button>
    <button class="btn" id="btn-export-annotated" title="Export annotated LaTeX">Export ∇</button>
    <button class="btn" id="btn-sample">Try an example</button>
    <button class="btn" id="btn-lean" title="Verify with Lean 4" style="display:none">${iconShieldCheck} Lean 4</button>
    <button class="btn btn-primary" id="btn-verify">${iconCheck} Verify</button>
  </div>
</nav>
<div class="workspace">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-section">
      <div class="sidebar-title">Axiom Budget</div>
      <div id="axiom-list"></div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-title">Dependency Graph</div>
      <div id="graph-container" style="min-height:120px"></div>
      <div id="dep-graph"></div>
    </div>
  </aside>
  <div class="resize-h" id="resize-sidebar"></div>
  <div class="main">
    <div class="main-split">
      <div class="editor-pane">
        <div class="pane-header">
          <div class="pane-title">Your mathematics <span style="font-weight:400;color:var(--text-muted);font-size:11px">— write naturally in LaTeX</span></div>
        </div>
        <textarea class="editor-textarea" id="editor" spellcheck="false"
          placeholder="Write or paste your LaTeX here…"></textarea>
        <div class="katex-preview" id="katex-preview" style="display:none;padding:12px 16px;overflow-y:auto;max-height:120px;border-top:1px solid var(--border);font-size:14px;background:var(--bg-main)"></div>
      </div>
      <div class="resize-h" id="resize-editor"></div>
      <div class="results-pane" id="results-pane">
        <div class="summary-bar" id="summary-bar">
          <div class="summary-icon idle">∑</div>
          <div class="summary-text">
            <div class="summary-title">Ready</div>
            <div class="summary-sub">Write LaTeX on the left to begin</div>
          </div>
        </div>
        <div class="code-section" id="code-section" style="display:none">
          <div class="code-tabs" id="code-tabs"></div>
          <div class="code-body" id="code-body"></div>
        </div>
      </div>
    </div>
    <div class="resize-v" id="resize-bottom"></div>
    <div class="bottom-panels" id="bottom-panels" style="display:none">
      <div class="bottom-panel">
        <div class="bottom-header">Counterexample Insights</div>
        <div class="bottom-body" id="insights-body"></div>
      </div>
      <div class="bottom-panel">
        <div class="bottom-header">Random Testing</div>
        <div class="bottom-body" id="random-body"></div>
      </div>
      <div class="bottom-panel">
        <div class="bottom-header">Proof Steps</div>
        <div class="bottom-body" id="proof-body"></div>
      </div>
    </div>
    <div class="status-line">
      <div class="status-item"><div class="status-dot" id="s-dot"></div><span id="s-label">Ready</span></div>
      <div class="status-item" id="s-stats"></div>
    </div>
  </div>
</div>
<div id="lens-root"></div>`;
}

// ── Bind events ─────────────────────────────────────────────

function bind() {
  const ed = $<HTMLTextAreaElement>('editor');
  ed.addEventListener('input', () => { S.source = ed.value; debouncedRun(); renderKaTeXPreview(ed.value); });
  $('btn-sample').addEventListener('click', loadSample);
  $('btn-verify').addEventListener('click', run);
  $('btn-download').addEventListener('click', downloadOutput);
  $('btn-lean').addEventListener('click', runLeanVerify);
  $('btn-export-annotated').addEventListener('click', downloadAnnotatedLaTeX);

  // Dark mode
  $('btn-dark').addEventListener('click', toggleDarkMode);

  // File upload
  const fileInput = $<HTMLInputElement>('file-input');
  $('btn-upload').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      ed.value = text;
      S.source = text;
      run();
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  // Restore API key from session storage (never persisted to disk)
  const keyInput = $<HTMLInputElement>('llm-key');
  const modelSelect = $<HTMLSelectElement>('llm-model');
  const storedKey = sessionStorage.getItem('sigma-llm-key');
  const storedModel = sessionStorage.getItem('sigma-llm-model');
  if (storedKey) keyInput.value = storedKey;
  if (storedModel) modelSelect.value = storedModel;
  keyInput.addEventListener('change', () => {
    sessionStorage.setItem('sigma-llm-key', keyInput.value.trim());
  });
  modelSelect.addEventListener('change', () => {
    sessionStorage.setItem('sigma-llm-model', modelSelect.value);
  });

  renderAxiomBudget();
  setRunCallback(run);
  initResizeHandles();

  // Keyboard shortcuts
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key === 'Enter') {
      e.preventDefault();
      run();
    }
    if (meta && e.key === 's') {
      e.preventDefault();
      downloadOutput();
    }
  });

  // Check Lean bridge on startup
  checkBridgeHealth().then(({ available, version }) => {
    const dot = document.querySelector('#bridge-status .bridge-dot') as HTMLElement;
    const label = document.querySelector('#bridge-status .bridge-label') as HTMLElement;
    if (available) {
      $('btn-lean').style.display = '';
      $('btn-lean').title = `Lean 4 available: ${version || 'connected'}`;
      if (dot) { dot.className = 'bridge-dot online'; }
      if (label) { label.textContent = version ? `Lean ${version}` : 'Connected'; }
      $('bridge-status').title = `Lean 4 Bridge: connected (${version || ''})`;
    } else {
      if (dot) { dot.className = 'bridge-dot offline'; }
      if (label) { label.textContent = 'Offline'; }
      $('bridge-status').title = 'Lean 4 Bridge: offline — run npm run bridge';
    }
  });
}

// ── Lean 4 verification ─────────────────────────────────────

async function runLeanVerify() {
  if (!S.ir) {
    setStatus('idle', 'Run Verify first');
    return;
  }

  // Emit fresh Lean 4 code if not already done
  if (!S.lean4) {
    const { buildAxiomBundle } = await import('./render/axioms');
    const bundle = buildAxiomBundle();
    S.lean4 = emitLean4({ ...S.ir, axiomBundle: bundle });
  }

  setStatus('processing', 'Verifying with Lean 4…');
  const leanBtn = $('btn-lean');
  leanBtn.innerHTML = `${iconShieldCheck} Compiling…`;
  leanBtn.setAttribute('disabled', 'true');

  try {
    const result = await verifyLeanCode(S.lean4.code);
    const summary = formatLeanDiagnostics(result);

    // Show in the insights panel
    const insightsBody = $('insights-body');
    const statusBg = result.success ? 'var(--success-light)' : 'var(--error-light)';
    insightsBody.innerHTML = `<div style="margin-top:8px;padding:8px;border-radius:4px;background:${statusBg}"><pre style="margin:0;font-size:11px;white-space:pre-wrap">${esc(summary)}</pre></div>` + insightsBody.innerHTML;
    $('bottom-panels').style.display = '';

    if (result.success) {
      setStatus('done', `Lean 4: ✓ Verified (${result.elapsed.toFixed(0)}ms)`);
      leanBtn.innerHTML = `${iconShieldCheck} ✓ Verified`;
    } else {
      const errCount = result.errors.length;
      setStatus('idle', `Lean 4: ✗ ${errCount} error${errCount !== 1 ? 's' : ''}`);
      leanBtn.innerHTML = `${iconShieldCheck} ✗ ${errCount} errors`;
    }
  } catch {
    setStatus('idle', 'Lean bridge not running');
    const insightsBody = $('insights-body');
    insightsBody.innerHTML = `<div style="margin-top:8px;padding:8px;border-radius:4px;background:var(--error-light);font-size:11px">
      <strong>Lean bridge not running.</strong><br/>
      Start it with: <code>npm run bridge</code><br/>
      The bridge starts a local server on port 9473 that compiles Lean 4 code via the <code>lean</code> binary.
    </div>` + insightsBody.innerHTML;
    $('bottom-panels').style.display = '';
    leanBtn.innerHTML = `${iconShieldCheck} Lean 4`;
  }
  leanBtn.removeAttribute('disabled');
}

// ── Annotated LaTeX export ──────────────────────────────────

function downloadAnnotatedLaTeX() {
  if (!S.ir || !S.tc) {
    return;
  }
  const annotated = exportAnnotatedLaTeX(S.source, S.ir, S.tc, S.lean4, S.report);
  const blob = new Blob([annotated], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'annotated.tex';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Dark mode ───────────────────────────────────────────────

function toggleDarkMode() {
  document.body.classList.toggle('dark');
  const btn = $('btn-dark');
  btn.innerHTML = document.body.classList.contains('dark') ? iconSun : iconMoon;
}

// ── KaTeX preview ───────────────────────────────────────────

function renderKaTeXPreview(source: string) {
  const preview = $('katex-preview');
  const mathBlocks = [...source.matchAll(/\$\$([^$]+)\$\$/g), ...source.matchAll(/\$([^$]+)\$/g)];
  if (mathBlocks.length === 0) {
    preview.style.display = 'none';
    return;
  }
  preview.style.display = 'block';
  let html = '';
  for (const match of mathBlocks) {
    try {
      html += '<div style="margin:4px 0">' + katex.renderToString(match[1], {
        throwOnError: false,
        displayMode: match[0].startsWith('$$'),
      }) + '</div>';
    } catch {
      html += `<div style="color:var(--danger);font-size:11px">Parse error: ${match[1].slice(0, 40)}…</div>`;
    }
  }
  preview.innerHTML = html;
}

// ── Dependency graph rendering ──────────────────────────────

let graphRenderer: GraphRenderer | null = null;

function renderDependencyGraph() {
  if (!S.ir) return;
  const container = document.getElementById('graph-container');
  if (!container) return;

  // Build DependencyGraph compatible with GraphRenderer
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

// ── Resizable pane borders ──────────────────────────────────

function initResizeHandles() {
  // Sidebar resize (horizontal)
  setupHResize('resize-sidebar', 'sidebar', null, 140, 400);

  // Editor/Results resize (horizontal)
  setupHResize('resize-editor', 'editor-pane-wrap', 'results-pane-wrap', 200, null);

  // Bottom panels resize (vertical)
  setupVResize('resize-bottom', 'bottom-panels', 80, 500);
}

function setupHResize(handleId: string, leftSel: string, _rightSel: string | null, minW: number, maxW: number | null) {
  const handle = document.getElementById(handleId);
  if (!handle) return;

  let leftEl: HTMLElement | null = null;

  // Find the element: for sidebar it's by id, for editor it's by class
  if (leftSel === 'sidebar') {
    leftEl = document.getElementById('sidebar');
  } else {
    // Find editor-pane (it's a class, get the first one)
    leftEl = document.querySelector('.editor-pane') as HTMLElement;
  }
  if (!leftEl) return;

  let startX = 0;
  let startW = 0;

  const onPointerMove = (e: PointerEvent) => {
    const delta = e.clientX - startX;
    let newW = startW + delta;
    if (newW < minW) newW = minW;
    if (maxW && newW > maxW) newW = maxW;
    leftEl!.style.flex = 'none';
    leftEl!.style.width = newW + 'px';
  };

  const onPointerUp = () => {
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  };

  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    e.preventDefault();
    startX = e.clientX;
    startW = leftEl!.getBoundingClientRect().width;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  });
}

function setupVResize(handleId: string, panelId: string, minH: number, maxH: number) {
  const handle = document.getElementById(handleId);
  const panel = document.getElementById(panelId);
  if (!handle || !panel) return;

  let startY = 0;
  let startH = 0;

  const onPointerMove = (e: PointerEvent) => {
    // Dragging up = increase height, dragging down = decrease
    const delta = startY - e.clientY;
    let newH = startH + delta;
    if (newH < minH) newH = minH;
    if (newH > maxH) newH = maxH;
    panel.style.height = newH + 'px';
  };

  const onPointerUp = () => {
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  };

  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    e.preventDefault();
    startY = e.clientY;
    startH = panel.getBoundingClientRect().height;
    handle.classList.add('dragging');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  });
}

function debouncedRun() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(run, 500);
}

// ── Pipeline ────────────────────────────────────────────────

async function run() {
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
    // Resolve \input{} / \include{} directives before parsing
    const resolved = await resolveMultiFile(S.source, new InMemoryFileProvider());
    const doc = parseLatex(resolved.source);

    // Show parse errors if any
    if (doc.parseErrors && doc.parseErrors.length > 0) {
      console.warn(`[Parser] ${doc.parseErrors.length} parse warning(s):`, doc.parseErrors.map(e => e.message));
    }

    // LLM-assisted hypothesis refinement (async, non-blocking)
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
    // Test ALL theorems, not just the first
    if (theorems.length > 0) {
      // Run counterexample engine on each theorem and merge reports
      const reports = await Promise.all(theorems.map(t => runCounterexampleEngine(t)));
      S.report = reports[0]; // Primary report

      // Merge all results into the first report
      if (reports.length > 1) {
        for (let i = 1; i < reports.length; i++) {
          S.report.results.push(...reports[i].results);
          S.report.summary += ' | ' + reports[i].summary;
        }
      }

      // QuickCheck random testing on each theorem
      for (const thm of theorems) {
        const vars = extractVariables(thm.statement);
        if (vars.length > 0) {
          // Pass theorem params as preconditions so the tester
          // skips inputs that violate hypotheses (e.g., non-prime p)
          const rr = quickCheck(thm.statement, vars, 5000, thm.params);
          if (!S.randomReport || rr.failed > 0) {
            S.randomReport = rr;
          }
        }
      }
      if (!S.randomReport) S.randomReport = null;
    } else {
      S.report = null;
      S.randomReport = null;
    }

    S.status = 'done';
    renderDependencyGraph();
    renderKaTeXPreview(S.source);
    renderAll();
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
}

// ── Render Everything ───────────────────────────────────────

function renderAll() {
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
    `${dc} statement${dc > 1 ? 's' : ''} processed`
  );

  renderCodeSection();
  renderBottomPanels();
  renderDepGraph();

  setStatus('done', 'Verified');
  const h = S.tc!.holes.length;
  $('s-stats').textContent = `${dc} result${dc > 1 ? 's' : ''} · ${h} hole${h !== 1 ? 's' : ''} · ${getActiveAxioms().length} axioms`;
}

// ── (Summary rendering delegated to ./render/summary.ts) ─────

// ── Code Section (delegated to ./render/code.ts) ────────────

// ── Bottom Panels ───────────────────────────────────────────

function renderBottomPanels() {
  $('bottom-panels').style.display = 'flex';
  renderInsights();
  renderRandomTests();
  renderProofSteps();
}

// ── (Axiom budget delegated to ./render/axioms.ts) ──────────

// ── (Dep graph sidebar delegated to ./render/axioms.ts) ─────

// ── (Notation lens delegated to ./render/lens.ts) ───────────

// ── (Syntax highlighting delegated to ./render/code.ts) ─────

// ── (Friendly descriptions delegated to ./render/insights.ts) ──

// ── Status ──────────────────────────────────────────────────

function setStatus(mode: 'idle' | 'processing' | 'done', label: string) {
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

// ── File Download ───────────────────────────────────────────

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

// ── Sample ──────────────────────────────────────────────────

function loadSample() {
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
  run();
}

// ── (Helpers $, esc delegated to ./state.ts) ────────────────
