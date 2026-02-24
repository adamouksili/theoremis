// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Summary Bar Renderer
// ─────────────────────────────────────────────────────────────

import { $, S } from '../state';
import { iconCheck, iconWarn } from '../icons';
import type { EmitterResult } from '../../emitters/lean4';

export function renderSummary(iconCls: string, iconChar: string, title: string, sub: string): void {
  const bar = $('summary-bar');
  const pills = S.lean4 && S.ir && S.ir.declarations.length > 0
    ? `<div class="summary-pills">
         ${pill('Lean 4', S.lean4)} ${pill('Coq', S.coq)} ${pill('Isabelle', S.isabelle)}
       </div>` : '';
  bar.innerHTML = `
    <div class="summary-icon ${iconCls}">${iconChar}</div>
    <div class="summary-text">
      <div class="summary-title">${title}</div>
      <div class="summary-sub">${sub}</div>
    </div>
    ${pills}`;
}

function pill(name: string, r: EmitterResult | null): string {
  if (!r) return '';
  const c = r.warnings.length > 0 ? 'warn' : 'ok';
  return `<div class="pill ${c}">${c === 'ok' ? iconCheck : iconWarn} ${name}</div>`;
}
