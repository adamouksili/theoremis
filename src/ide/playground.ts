// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Playground
// Minimal "paste your theorem → see hypothesis necessity" page.
// Designed for first impressions: no login, no setup, 10 seconds.
// ─────────────────────────────────────────────────────────────

import { sharedNav, sharedFooter } from './shared-chrome';

import { parseLatex, documentToIR } from '../parser/latex';
import { BUNDLES } from '../core/ir';
import type { Theorem } from '../core/ir';
import { runCounterexampleEngine } from '../engine/counterexample';
import type { PathologyReport, CounterexampleResult } from '../engine/counterexample';

// ── Shell ───────────────────────────────────────────────────

const DEFAULT_THEOREM = `\\begin{theorem}[Fermat's Little Theorem]
Let $p$ be a prime number and $a$ an integer coprime to $p$.
Then $a^{p-1} \\equiv 1 \\pmod{p}$.
\\end{theorem}`;

export function playgroundShell(): string {
  return `<div class="landing pg">
  ${sharedNav('playground')}

  <main class="pg-main">
    <div class="pg-hero">
      <h1 class="pg-hero-title">Hypothesis Necessity Linter</h1>
      <p class="pg-hero-sub">Paste a LaTeX theorem — see which hypotheses are necessary and which might be redundant.</p>
    </div>

    <div class="pg-input-section">
      <label class="pg-label" for="pg-input">Paste a LaTeX theorem</label>
      <textarea id="pg-input" class="pg-textarea" spellcheck="false" rows="8">${DEFAULT_THEOREM}</textarea>
      <button id="pg-run" class="pg-btn">Analyze Hypotheses</button>
    </div>

    <div id="pg-output" class="pg-output">
      <div class="pg-placeholder">Results will appear here.</div>
    </div>
  </main>

  ${sharedFooter()}
</div>`;
}

// ── Bind ────────────────────────────────────────────────────

export function bindPlayground(): void {
  const btn = document.getElementById('pg-run') as HTMLButtonElement | null;
  const input = document.getElementById('pg-input') as HTMLTextAreaElement | null;
  const output = document.getElementById('pg-output') as HTMLDivElement | null;
  if (!btn || !input || !output) return;

  btn.addEventListener('click', async () => {
    const latex = input.value.trim();
    if (!latex) {
      output.innerHTML = '<div class="pg-error">Paste a LaTeX theorem to analyze.</div>';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Analyzing…';
    output.innerHTML = '<div class="pg-loading">Running mutation analysis…</div>';

    try {
      const result = await analyzePlayground(latex);
      output.innerHTML = result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      output.innerHTML = `<div class="pg-error">Error: ${escHtml(msg)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Analyze Hypotheses';
    }
  });

  // Auto-run on load with the default example
  btn.click();
}

// ── Analysis ────────────────────────────────────────────────

async function analyzePlayground(latex: string): Promise<string> {
  const doc = parseLatex(latex);
  const ir = documentToIR(doc, BUNDLES['ClassicalMath']);

  const theorems = ir.declarations.filter(
    (d): d is Theorem => d.tag === 'Theorem',
  );

  if (theorems.length === 0) {
    return '<div class="pg-error">No theorems found. Wrap your statement in <code>\\begin{theorem}...\\end{theorem}</code>.</div>';
  }

  const sections: string[] = [];

  for (const thm of theorems) {
    const report = await runCounterexampleEngine(thm);
    sections.push(renderReport(thm.name, thm.params, report));
  }

  return sections.join('');
}

function renderReport(
  name: string,
  params: Array<{ name: string; type: unknown }>,
  report: PathologyReport,
): string {
  const drops = report.results.filter(r => r.mutation.type === 'drop_hypothesis');
  const others = report.results.filter(r => r.mutation.type !== 'drop_hypothesis');

  let html = `<div class="pg-theorem">`;
  html += `<h3 class="pg-thm-name">${escHtml(name)}</h3>`;

  // Hypothesis necessity
  if (drops.length > 0) {
    html += `<div class="pg-section-label">Hypothesis Necessity</div>`;
    for (const r of drops) {
      html += renderHypothesisRow(r);
    }
  } else if (params.length === 0) {
    html += `<div class="pg-no-hyps">No hypotheses to test (universally quantified).</div>`;
  }

  // Other mutations
  if (others.length > 0) {
    html += `<div class="pg-section-label">Mutation Robustness</div>`;
    for (const r of others) {
      html += renderMutationRow(r);
    }
  }

  html += `<div class="pg-meta">${report.results.length} mutations tested · ${report.overallConfidence > 0.8 ? 'high' : report.overallConfidence > 0.5 ? 'medium' : 'low'} confidence</div>`;
  html += `</div>`;
  return html;
}

function renderHypothesisRow(r: CounterexampleResult): string {
  const necessary = r.status === 'counterexample_found';
  const icon = necessary ? '●' : '○';
  const cls = necessary ? 'pg-necessary' : 'pg-redundant';
  const label = necessary ? 'necessary' : 'potentially redundant';
  const param = r.mutation.droppedParam ?? '?';

  let witness = '';
  if (r.witness) {
    const entries: string[] = [];
    for (const [k, v] of r.witness.assignments) {
      entries.push(`${k}=${v}`);
    }
    if (entries.length > 0 && entries.length <= 4) {
      witness = `<span class="pg-witness">counterexample: ${escHtml(entries.join(', '))}</span>`;
    } else if (r.witness.description) {
      witness = `<span class="pg-witness">${escHtml(r.witness.description)}</span>`;
    }
  }

  return `<div class="pg-row ${cls}">
    <span class="pg-icon">${icon}</span>
    <span class="pg-param">${escHtml(param)}</span>
    <span class="pg-label">${label}</span>
    ${witness}
  </div>`;
}

function renderMutationRow(r: CounterexampleResult): string {
  const caught = r.status === 'counterexample_found';
  const icon = caught ? '✗' : '≈';
  const cls = caught ? 'pg-caught' : 'pg-survived';
  const label = caught ? 'caught' : 'survived';

  return `<div class="pg-row ${cls}">
    <span class="pg-icon">${icon}</span>
    <span class="pg-param">${escHtml(r.mutation.type.replace(/_/g, ' '))}</span>
    <span class="pg-label">${label}</span>
    <span class="pg-desc">${escHtml(r.mutation.description)}</span>
  </div>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
