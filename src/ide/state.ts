// ─────────────────────────────────────────────────────────────
// Theoremis  ·  IDE Application State
// ─────────────────────────────────────────────────────────────

import type { IRModule, Declaration } from '../core/ir';
import type { EmitterResult } from '../emitters/lean4';
import type { TypeCheckResult } from '../core/typechecker';
import type { PathologyReport } from '../engine/counterexample';
import type { RandomTestReport } from '../engine/evaluator';

export interface AppState {
  source: string;
  ir: IRModule | null;
  tc: TypeCheckResult | null;
  lean4: EmitterResult | null;
  coq: EmitterResult | null;
  isabelle: EmitterResult | null;
  report: PathologyReport | null;
  randomReport: RandomTestReport | null;
  tab: 'lean4' | 'coq' | 'isabelle';
  status: 'idle' | 'processing' | 'done';
  axioms: Record<string, boolean>;
  lensDecl: Declaration | null;
  llmSuggestions: Record<string, string>;
}

export const S: AppState = {
  source: '', ir: null, tc: null,
  lean4: null, coq: null, isabelle: null,
  report: null, randomReport: null,
  tab: 'lean4', status: 'idle',
  axioms: { LEM: true, Choice: true, Funext: true, Propext: true, Quotient: false, Univalence: false },
  lensDecl: null,
  llmSuggestions: {},
};

// ── DOM helpers ─────────────────────────────────────────────

export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
