// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Proof Step Renderer + Multi-Turn Proof Loop
// Phase 2: Goal-aware AI tactics + accept/edit/re-query
// ─────────────────────────────────────────────────────────────

import { $, esc, S } from '../state';
import { prettyTerm, prettyTactic } from '../../core/pretty';
import { suggestMathlibLemma } from '../../bridge/mathlib-db';
import {
  queryGoalAwareTactics,
  detectProvider,
  defaultModelForProvider,
  type TacticSuggestion,
  type ProofGoalState,
} from '../../engine/llm';
import { iconSparkles, iconCheck } from '../icons';
import type { Theorem, Lemma, Tactic } from '../../core/ir';

type ProofDecl = Theorem | Lemma;

// ── Proof session state (multi-turn) ────────────────────────

interface ProofSession {
  declName: string;
  acceptedTactics: string[];
  pendingSuggestions: TacticSuggestion[];
  goalHistory: string[];  // Track goal evolution
  isActive: boolean;
}

const sessions: Map<string, ProofSession> = new Map();

function getSession(name: string): ProofSession {
  if (!sessions.has(name)) {
    sessions.set(name, {
      declName: name,
      acceptedTactics: [],
      pendingSuggestions: [],
      goalHistory: [],
      isActive: false,
    });
  }
  return sessions.get(name)!;
}

// ── Main renderer ───────────────────────────────────────────

export function renderProofSteps(): void {
  const body = $('proof-body');
  if (!S.ir) { body.innerHTML = '<div class="empty"><div class="empty-text">No proof data</div></div>'; return; }

  const thms = S.ir.declarations.filter((d): d is ProofDecl => d.tag === 'Theorem' || d.tag === 'Lemma');
  if (thms.length === 0) { body.innerHTML = '<div class="empty"><div class="empty-text">No proofs found</div></div>'; return; }

  let html = '';
  for (const decl of thms) {
    const proof = decl.proof;
    if (!proof || proof.length === 0) continue;

    const session = getSession(decl.name);
    const activeLlm = S.llmSuggestions[decl.name];

    html += `<div style="font-size:11px;font-weight:600;margin:6px 0 4px">${esc(decl.name)}</div>`;

    // Show original proof tactics
    proof.forEach((tac: Tactic, i: number) => {
      const isSorry = tac.tag === 'Sorry';
      const txt = prettyTactic(tac);
      const ghost = isSorry ? ghostSuggestion(decl) : '';

      html += `<div class="proof-step">
        <div class="step-num">${i + 1}</div>
        <div class="step-tactic${isSorry ? ' ghost-step' : ''}">${esc(txt)}</div>
        <div class="step-goal">
          ${isSorry ? `<button class="btn btn-sm ask-ai-btn" data-decl="${esc(decl.name)}" style="padding:0 4px;font-size:9px;margin-right:4px">${iconSparkles} Ask AI</button> <span style="color:var(--text-muted)">open</span>` : iconCheck}
        </div>
      </div>`;

      // Show accepted session tactics
      if (isSorry && session.acceptedTactics.length > 0) {
        session.acceptedTactics.forEach((at, j) => {
          html += `<div class="proof-step" style="opacity:0.9">
            <div class="step-num" style="background:var(--success-light);color:var(--success);font-size:10px">${iconCheck}</div>
            <div class="step-tactic" style="color:var(--success)">${esc(at)}</div>
            <div class="step-goal" style="font-size:9px;color:var(--success)">accepted #${j + 1}</div>
          </div>`;
        });
      }

      // Show pending multi-tactic suggestions
      if (isSorry && session.pendingSuggestions.length > 0) {
        html += `<div class="ai-suggestions-block" data-decl="${esc(decl.name)}">`;
        html += `<div style="font-size:9px;color:var(--accent);padding:4px 0 2px;font-weight:600">${iconSparkles} AI Suggestions (pick one):</div>`;
        session.pendingSuggestions.forEach((sug, si) => {
          const confPct = Math.round(sug.confidence * 100);
          const confColor = confPct >= 80 ? 'var(--success)' : confPct >= 50 ? 'var(--warning)' : 'var(--text-muted)';
          html += `<div class="proof-step ai-suggestion" style="opacity:0.85;cursor:pointer;border-left:2px solid var(--accent);margin-left:8px;padding-left:6px" data-decl="${esc(decl.name)}" data-idx="${si}">
            <div class="step-num" style="background:var(--accent-light);color:var(--accent);font-size:10px">${si + 1}</div>
            <div class="step-tactic" style="color:var(--text)">${esc(sug.tactic)}</div>
            <div class="step-goal" style="font-size:9px">
              <span style="color:${confColor}">${confPct}%</span>
              <button class="btn btn-sm accept-tactic-btn" data-decl="${esc(decl.name)}" data-idx="${si}" style="padding:0 4px;font-size:9px;margin-left:4px;color:var(--success)">✓ Accept</button>
            </div>
          </div>`;
          if (sug.explanation) {
            html += `<div style="font-size:10px;color:var(--text-muted);padding:0 0 4px 38px;line-height:1.3">${esc(sug.explanation)}</div>`;
          }
        });
        html += `</div>`;
      }

      // Legacy single suggestion (backwards compat)
      else if (activeLlm && isSorry && session.pendingSuggestions.length === 0) {
        html += `<div class="proof-step" style="opacity:0.8">
          <div class="step-num" style="background:none;font-size:10px;color:var(--accent)">${iconSparkles}</div>
          <div class="step-tactic ghost-step" style="color:var(--text)">${esc(activeLlm)}</div>
          <div class="step-goal" style="font-size:9px;color:var(--accent)">AI suggestion</div>
        </div>`;
      } else if (ghost && isSorry) {
        html += `<div class="proof-step" style="opacity:0.45">
          <div class="step-num" style="background:none;font-size:10px">›</div>
          <div class="step-tactic ghost-step">${esc(ghost)}</div>
          <div class="step-goal" style="font-size:9px">heuristic</div>
        </div>`;
      }
    });

    // Show "Goals accomplished" if enough tactics accepted
    if (session.acceptedTactics.length >= 3 && session.isActive) {
      html += `<div class="proof-step" style="background:var(--success-light);border-radius:6px;padding:4px 8px;margin-top:4px">
        <div class="step-num" style="background:none;color:var(--success);font-size:14px">🎉</div>
        <div class="step-tactic" style="color:var(--success);font-weight:600">Goals accomplished</div>
        <div class="step-goal" style="font-size:9px;color:var(--success)">${session.acceptedTactics.length} tactics</div>
      </div>`;
    }
  }

  body.innerHTML = html || '<div class="empty"><div class="empty-text">No proof tactics found</div></div>';

  // ── Bind AI buttons ─────────────────────────────────────────
  bindAskAIButtons(thms);
  bindAcceptButtons(thms);
}

function bindAskAIButtons(thms: ProofDecl[]): void {
  const body = $('proof-body');
  body.querySelectorAll('.ask-ai-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const declName = (btn as HTMLElement).dataset.decl!;
      const keyInput = $<HTMLInputElement>('llm-key');
      const key = keyInput.value.trim();
      if (!key) {
        alert('Please enter an API key (OpenAI, Anthropic, or GitHub PAT) in the top bar.');
        keyInput.focus();
        return;
      }
      const modelSelect = document.getElementById('llm-model') as HTMLSelectElement | null;
      const selectedModel = modelSelect?.value;
      const provider = detectProvider(key);
      const model = selectedModel && selectedModel !== 'auto' ? selectedModel : defaultModelForProvider(provider);

      const prevText = btn.textContent;
      btn.textContent = 'Thinking...';
      (btn as HTMLButtonElement).disabled = true;

      const decl = thms.find(d => d.name === declName);
      if (!decl) return;

      const statement = prettyTerm(decl.statement);
      const session = getSession(declName);
      const previousSteps = [
        ...decl.proof.map(t => prettyTactic(t)),
        ...session.acceptedTactics,
      ];

      // Build goal state for goal-aware query
      const goalState: ProofGoalState = {
        goal: statement,
        hypotheses: decl.params.map(p => `${p.name} : ${prettyTerm(p.type)}`),
        theoremName: declName,
        statement,
        previousTactics: previousSteps,
        mathlibHints: getMathlibHints(decl),
      };

      try {
        const suggestions = await queryGoalAwareTactics(key, goalState, { provider, model });
        session.pendingSuggestions = suggestions;
        session.isActive = true;

        // Also store first suggestion in legacy format
        if (suggestions.length > 0) {
          S.llmSuggestions[declName] = suggestions[0].tactic;
        }
        renderProofSteps();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        alert('LLM Failed: ' + msg);
        btn.textContent = prevText;
        (btn as HTMLButtonElement).disabled = false;
      }
    });
  });
}

function bindAcceptButtons(_thms: ProofDecl[]): void {
  const body = $('proof-body');
  body.querySelectorAll('.accept-tactic-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const declName = (btn as HTMLElement).dataset.decl!;
      const idx = parseInt((btn as HTMLElement).dataset.idx!, 10);
      const session = getSession(declName);

      if (session.pendingSuggestions[idx]) {
        const accepted = session.pendingSuggestions[idx];
        session.acceptedTactics.push(accepted.tactic);
        session.pendingSuggestions = []; // Clear pending after accept
        session.goalHistory.push(accepted.tactic);

        // ── INSERT TACTIC INTO LEAN CODE PANEL ──
        // Find the code output element and replace the first `sorry` with the accepted tactic
        insertTacticIntoCode(accepted.tactic);

        renderProofSteps();
      }
    });
  });
}

/** Replace the first `sorry` in the Lean 4 code panel with the accepted tactic */
function insertTacticIntoCode(tactic: string): void {
  // The Lean 4 code panel uses a <pre><code> block inside the output section
  const codeBlocks = document.querySelectorAll('.code-output pre code, .output-section pre code, #output pre code');
  for (const block of codeBlocks) {
    const text = block.textContent || '';
    if (text.includes('sorry')) {
      // Replace first occurrence of `sorry` (preserving indentation)
      block.textContent = text.replace(/(\s*)sorry/, `$1${tactic}`);

      // Flash green to show the change
      const pre = block.parentElement;
      if (pre) {
        pre.style.transition = 'background 300ms';
        pre.style.background = 'rgba(34, 197, 94, 0.1)';
        setTimeout(() => { pre.style.background = ''; }, 1500);
      }
      return;
    }
  }
}

function getMathlibHints(decl: ProofDecl): string[] {
  const statement = prettyTerm(decl.statement);
  const hints: string[] = [];

  const mathlibSuggestion = suggestMathlibLemma(decl.name, statement);
  if (mathlibSuggestion) {
    hints.push(`${mathlibSuggestion.lean4Name} — ${mathlibSuggestion.description}`);
  }

  // Add hints based on proof structure
  const name = decl.name.toLowerCase();
  if (name.includes('comm') || statement.includes('comm')) hints.push('Nat.add_comm, Nat.mul_comm');
  if (name.includes('assoc') || statement.includes('assoc')) hints.push('Nat.add_assoc, Nat.mul_assoc');
  if (statement.includes('0') && statement.includes('+')) hints.push('Nat.add_zero, Nat.zero_add');
  if (statement.includes('1') && statement.includes('*')) hints.push('Nat.mul_one, Nat.one_mul');
  if (statement.includes('mod') || statement.includes('≡')) hints.push('Nat.mod_def, ZMod.val_cast_of_lt');

  return hints;
}

function ghostSuggestion(decl: ProofDecl): string {
  const name = decl.name.toLowerCase();
  const statement = prettyTerm(decl.statement);
  const mathlibHint = suggestMathlibLemma(decl.name, statement);
  if (mathlibHint) {
    return `exact ${mathlibHint.lean4Name}`;
  }

  if (name.includes('induction') || (decl.proof.some(t => t.tag === 'Induction'))) {
    return 'simp [Nat.succ_eq_add_one]; ring';
  }
  if (name.includes('square') || name.includes('non_negative') || name.includes('nonneg')) {
    return 'nlinarith [sq_nonneg x]';
  }
  return 'aesop';
}
