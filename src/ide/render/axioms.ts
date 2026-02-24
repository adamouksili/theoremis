// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Axiom Budget + Dependency Graph Sidebar
// ─────────────────────────────────────────────────────────────

import { $, esc, S } from '../state';
import type { Axiom, Theorem, AxiomBundle } from '../../core/ir';
import { openLens } from './lens';

// ── Exposed run callback — set from app.ts after import ─────
let _runCallback: (() => void) | null = null;

export function setRunCallback(cb: () => void): void {
  _runCallback = cb;
}

// ── Axiom Budget ────────────────────────────────────────────

export function renderAxiomBudget(): void {
  const list = $('axiom-list');
  const axioms: Array<[string, string, string]> = [
    ['LEM', 'Excluded Middle', 'Classical logic'],
    ['Choice', 'Axiom of Choice', 'Selection functions'],
    ['Funext', 'Function Ext.', 'f = g ↔ ∀x, f x = g x'],
    ['Propext', 'Prop. Ext.', 'P ↔ Q → P = Q'],
    ['Quotient', 'Quotient Types', 'Setoid quotients'],
    ['Univalence', 'Univalence', 'HoTT axiom'],
  ];

  list.innerHTML = axioms.map(([key, label, note]) => {
    const on = S.axioms[key];
    return `<div class="axiom-item">
      <button class="axiom-toggle ${on ? 'on' : 'off'}" data-ax="${key}"></button>
      <div>
        <div class="axiom-label">${label}</div>
        <div class="axiom-note">${note}</div>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.axiom-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = (btn as HTMLElement).dataset.ax!;
      S.axioms[key] = !S.axioms[key];
      btn.className = `axiom-toggle ${S.axioms[key] ? 'on' : 'off'}`;
      if (S.ir && _runCallback) _runCallback();
    });
  });
}

export function getActiveAxioms(): string[] {
  return Object.entries(S.axioms).filter(([, v]) => v).map(([k]) => k);
}

export function buildAxiomBundle(): AxiomBundle {
  const activeAxioms = getActiveAxioms();
  return {
    name: 'Custom',
    axioms: new Set(activeAxioms as Axiom[]),
    description: `User-selected axioms: ${activeAxioms.join(', ') || '(none)'}`,
  };
}

// ── Dependency Graph (sidebar list) ─────────────────────────

export function renderDepGraph(): void {
  const el = $('dep-graph');
  if (!S.ir || S.ir.declarations.length === 0) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">No declarations</div>';
    return;
  }

  el.innerHTML = S.ir.declarations.map(decl => {
    const hasHoles = decl.tag === 'Theorem' && (decl as Theorem).proof.some(t => t.tag === 'Sorry');
    const dotCls = hasHoles ? 'hole' : 'ok';
    const typeLabel = decl.tag === 'Theorem' ? 'thm' : decl.tag === 'Lemma' ? 'lem' : 'def';
    return `<div class="dep-node" data-decl="${esc(decl.name)}" title="Click to inspect">
      <div class="dep-dot ${dotCls}"></div>
      <div class="dep-name">${esc(decl.name)}</div>
      <div class="dep-type">${typeLabel}</div>
    </div>`;
  }).join('');

  el.querySelectorAll('.dep-node').forEach(node => {
    node.addEventListener('click', () => {
      const name = (node as HTMLElement).dataset.decl!;
      const decl = S.ir!.declarations.find(d => d.name === name);
      if (decl) openLens(decl);
    });
  });
}
