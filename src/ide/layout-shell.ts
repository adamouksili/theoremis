import katex from 'katex';
import 'katex/dist/katex.min.css';

import { $ } from './state';
import { iconMoon, iconSun, iconShieldCheck } from './icons';

export function shell(): string {
  return `
<nav class="nav">
  <div class="nav-brand">
    <a href="#" class="ide-brand-link">
      <img src="/logo_transparent.png" alt="Theoremis" class="ide-brand-logo" />
      <span class="ide-brand-name">Theoremis</span>
    </a>
    <div class="nav-subtitle">AI-Powered Proof IDE</div>
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
    <label class="btn" id="btn-upload" title="Upload .lean file"><input type="file" id="file-input" accept=".lean,.txt" style="display:none">Upload .lean</label>
    <button class="btn" id="btn-translate" title="Translate LaTeX to Lean draft">Draft from LaTeX</button>
    <button class="btn" id="btn-download" title="Download output">Download</button>
    <button class="btn" id="btn-sample">Try an example</button>
    <button class="btn" id="btn-learn" title="Interactive tutorials">📚 Learn</button>
    <button class="btn" id="btn-share" title="Copy shareable link">Share</button>
    <button class="btn btn-primary" id="btn-verify">${iconShieldCheck} Kernel Verify</button>
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
          <div class="pane-title">Lean Source <span style="font-weight:400;color:var(--text-muted);font-size:11px">— kernel-checked verification only</span></div>
        </div>
        <textarea class="editor-textarea" id="editor" spellcheck="false"
          placeholder="Write or paste Lean 4 code here..."></textarea>
        <div class="katex-preview" id="katex-preview" style="display:none;padding:12px 16px;overflow-y:auto;max-height:120px;border-top:1px solid var(--border);font-size:14px;background:var(--bg-main)"></div>
      </div>
      <div class="resize-h" id="resize-editor"></div>
      <div class="results-pane" id="results-pane">
        <div class="summary-bar" id="summary-bar">
          <div class="summary-icon idle">∑</div>
          <div class="summary-text">
            <div class="summary-title">Ready</div>
            <div class="summary-sub">Write Lean, then run Kernel Verify</div>
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
      <div class="bottom-panel">
        <div class="bottom-header">Mathlib Search</div>
        <div class="bottom-body" id="mathlib-body"></div>
      </div>
    </div>
    <div class="status-line">
      <div class="status-item"><div class="status-dot" id="s-dot"></div><span id="s-label">Ready</span></div>
      <div class="status-item" id="s-stats"></div>
    </div>
  </div>
</div>
<div id="lens-root"></div>
<div id="tutorial-overlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:none;align-items:center;justify-content:center">
  <div id="tutorial-panel" style="background:var(--bg);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:480px;width:90%;max-height:80vh;overflow-y:auto;border:1px solid var(--border)"></div>
</div>`;
}

export function toggleDarkMode() {
  document.body.classList.toggle('dark');
  const btn = $('btn-dark');
  btn.innerHTML = document.body.classList.contains('dark') ? iconSun : iconMoon;
}

export function renderKaTeXPreview(source: string) {
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
      html += '<div style="margin:4px 0">' + katex.renderToString(match[1]!, {
        throwOnError: false,
        displayMode: match[0].startsWith('$$'),
      }) + '</div>';
    } catch {
      html += `<div style="color:var(--danger);font-size:11px">Parse error: ${match[1]!.slice(0, 40)}…</div>`;
    }
  }
  preview.innerHTML = html;
}

export function initResizeHandles() {
  setupHResize('resize-sidebar', 'sidebar', null, 140, 400);
  setupHResize('resize-editor', 'editor-pane-wrap', 'results-pane-wrap', 200, null);
  setupVResize('resize-bottom', 'bottom-panels', 80, 500);
}

function setupHResize(handleId: string, leftSel: string, _rightSel: string | null, minW: number, maxW: number | null) {
  const handle = document.getElementById(handleId);
  if (!handle) return;

  let leftEl: HTMLElement | null = null;

  if (leftSel === 'sidebar') {
    leftEl = document.getElementById('sidebar');
  } else {
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
