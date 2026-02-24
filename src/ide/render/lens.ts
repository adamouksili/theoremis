// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Notation Lens (Modal Inspector)
// ─────────────────────────────────────────────────────────────

import { $, esc, S } from '../state';
import { prettyTerm, prettyTactic } from '../../core/pretty';
import { highlight } from './code';
import { iconClose } from '../icons';
import type { Declaration } from '../../core/ir';

export function openLens(decl: Declaration): void {
  S.lensDecl = decl;
  const root = $('lens-root');

  const lean4Code = getBackendSnippet(decl, 'lean4');
  const coqCode = getBackendSnippet(decl, 'coq');
  const isaCode = getBackendSnippet(decl, 'isabelle');

  let irText = '';
  if (decl.tag === 'Theorem') {
    irText = `theorem ${decl.name}\n  ${decl.params.map(p => `(${p.name} : ${prettyTerm(p.type)})`).join(' ')}\n  : ${prettyTerm(decl.statement)}\n  := by\n    ${decl.proof.map(tac => prettyTactic(tac)).join('\n    ')}`;
  } else if (decl.tag === 'Definition') {
    irText = `def ${decl.name} := ${prettyTerm(decl.body)}`;
  } else if (decl.tag === 'Lemma') {
    irText = `lemma ${decl.name}\n  : ${prettyTerm(decl.statement)}\n  := by\n    ${decl.proof.map(t => prettyTactic(t)).join('\n    ')}`;
  }

  const axiomHtml = decl.tag === 'Theorem'
    ? Array.from(decl.axiomBundle.axioms).map(a =>
      `<div class="lens-axiom">${a}</div>`).join('')
    : '<div class="lens-axiom" style="background:#f5f5f4;color:#a8a29e">None</div>';

  root.innerHTML = `
  <div class="lens-overlay" id="lens-overlay">
    <div class="lens-card">
      <div class="lens-header">
        <div class="lens-name">${esc(decl.name)}</div>
        <button class="lens-close" id="lens-close">${iconClose}</button>
      </div>
      <div class="lens-body">
        <div class="lens-section">
          <div class="lens-section-title">λΠω IR Representation</div>
          <div class="lens-code">${esc(irText)}</div>
        </div>
        <div class="lens-section">
          <div class="lens-section-title">Axioms Used</div>
          <div class="lens-axioms">${axiomHtml}</div>
        </div>
        <div class="lens-section">
          <div class="lens-section-title">Lean 4</div>
          <div class="lens-code">${highlight(lean4Code, 'lean4')}</div>
        </div>
        <div class="lens-section">
          <div class="lens-section-title">Coq</div>
          <div class="lens-code">${highlight(coqCode, 'coq')}</div>
        </div>
        <div class="lens-section">
          <div class="lens-section-title">Isabelle/HOL</div>
          <div class="lens-code">${highlight(isaCode, 'isabelle')}</div>
        </div>
      </div>
    </div>
  </div>`;

  $('lens-close').addEventListener('click', closeLens);
  $('lens-overlay').addEventListener('click', (e) => {
    if ((e.target as HTMLElement).classList.contains('lens-overlay')) closeLens();
  });
}

export function closeLens(): void {
  $('lens-root').innerHTML = '';
  S.lensDecl = null;
}

function getBackendSnippet(decl: Declaration, backend: string): string {
  const code = backend === 'lean4' ? S.lean4?.code : backend === 'coq' ? S.coq?.code : S.isabelle?.code;
  if (!code) return '-- not available';
  const name = decl.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  const lines = code.split('\n');
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(name) && (lines[i].match(/\b(theorem|lemma|def|Definition|Theorem|Lemma|definition)\b/) || start === -1)) {
      start = i;
    }
    if (start >= 0 && i > start && (lines[i].match(/^(theorem|lemma|def|Definition|Theorem|Lemma|definition)\b/) || (backend === 'isabelle' && lines[i].trim() === '') && i > start + 2)) {
      end = i;
      break;
    }
  }
  if (start === -1) return code.slice(0, 500);
  return lines.slice(start, Math.min(end, start + 20)).join('\n');
}
