// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Counterexample & Random Test Renderers
// ─────────────────────────────────────────────────────────────

import { $, esc, S } from '../state';
import type { Mutation } from '../../engine/mutator';

export function renderInsights(): void {
  const body = $('insights-body');
  if (!S.report || S.report.results.length === 0) {
    body.innerHTML = '<div class="empty"><div class="empty-text">No counterexample data</div></div>';
    return;
  }

  const ces = S.report.results.filter(x => x.status === 'counterexample_found');
  const safe = S.report.results.filter(x => x.status === 'no_counterexample');

  let html = '';
  for (const ce of ces.slice(0, 6)) {
    const desc = friendly(ce.mutation);
    const wit = ce.witness ? `<div class="insight-sub">${esc(ce.witness.description)}</div>` : '';
    html += `<div class="insight"><div class="insight-dot ce"></div><div>${esc(desc)}${wit}</div></div>`;
  }
  for (const s of safe.slice(0, 3)) {
    html += `<div class="insight"><div class="insight-dot safe"></div><div>${esc(friendly(s.mutation))}</div></div>`;
  }
  body.innerHTML = html;
}

export function renderRandomTests(): void {
  const body = $('random-body');
  if (!S.randomReport) {
    body.innerHTML = '<div class="empty"><div class="empty-text">No random testing data</div></div>';
    return;
  }

  const r = S.randomReport;
  const qualifyingTests = r.passed + r.failed;
  const pct = qualifyingTests > 0 ? Math.round((r.passed / qualifyingTests) * 100) : 0;
  const color = pct === 100 ? 'var(--success)' : pct > 90 ? 'var(--warning)' : 'var(--error)';
  const classLabel = classificationLabel(r.classification);
  const preSkip = (r as any).preconditionSkipped ?? 0;

  let html = `
    <div class="confidence-line" style="border:none;padding:8px 0">
      <div class="confidence-label">${r.passed}/${qualifyingTests} passed</div>
      <div class="confidence-track"><div class="confidence-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="confidence-label">${pct}%</div>
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">
      ${r.time.toFixed(1)}ms · QuickCheck random testing · ${classLabel}${r.skipped > 0 ? ` · ${r.skipped} unevaluable` : ''}
    </div>`;

  if (preSkip > 0) {
    html += `<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-style:italic">
      ${preSkip} of ${preSkip + qualifyingTests + r.skipped} inputs didn't meet hypotheses (filtered)
    </div>`;
  }

  if (r.counterexamples.length > 0) {
    html += `<div style="font-size:11px;font-weight:600;color:var(--error);margin-bottom:4px">Counterexamples found:</div>`;
    for (const ce of r.counterexamples.slice(0, 3)) {
      const vals = Object.entries(ce.witness).map(([k, v]) => `${k}=${v}`).join(', ');
      html += `<div class="insight"><div class="insight-dot random"></div><div style="font-family:var(--font-mono);font-size:11px">${esc(vals)} → ${esc(String(ce.evaluated))}</div></div>`;
    }
  }
  body.innerHTML = html;
}

function classificationLabel(cls: string): string {
  switch (cls) {
    case 'verified': return '<span style="color:var(--success);font-weight:600">✓ Verified</span>';
    case 'likely_true': return '<span style="color:var(--success)">Likely true</span>';
    case 'indeterminate': return '<span style="color:var(--warning)">Indeterminate</span>';
    case 'likely_false': return '<span style="color:var(--error)">Likely false</span>';
    case 'falsified': return '<span style="color:var(--error);font-weight:600">✗ Falsified</span>';
    default: return cls;
  }
}

export function friendly(m: Mutation): string {
  switch (m.type) {
    case 'drop_hypothesis': return `Hypothesis "${m.droppedParam}" is necessary — removing it breaks the theorem`;
    case 'weaken_condition': return m.description.replace(/Strengthen|Weaken/g, x => x === 'Strengthen' ? 'Tightening' : 'Loosening');
    case 'swap_quantifier': return 'Swapping ∀ and ∃ changes the truth value';
    case 'change_domain': return m.description.replace('Change domain', 'Extending the domain');
    case 'negate_conclusion': return 'Negating the conclusion produces a contradiction';
    case 'strengthen_conclusion': return 'Strict inequality fails at the boundary';
    case 'perturb_constant': return 'Changing a constant invalidates the identity';
    default: return m.description;
  }
}
