// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Proof Step Renderer + Ghost Suggestions
// ─────────────────────────────────────────────────────────────

import { $, esc, S } from '../state';
import { prettyTerm, prettyTactic } from '../../core/pretty';
import { suggestMathlibLemma } from '../../bridge/mathlib-db';
import { queryLLMForProofStep, detectProvider, defaultModelForProvider } from '../../engine/llm';
import { iconSparkles, iconCheck } from '../icons';
import type { Theorem, Lemma, Tactic } from '../../core/ir';

type ProofDecl = Theorem | Lemma;

export function renderProofSteps(): void {
  const body = $('proof-body');
  if (!S.ir) { body.innerHTML = '<div class="empty"><div class="empty-text">No proof data</div></div>'; return; }

  const thms = S.ir.declarations.filter((d): d is ProofDecl => d.tag === 'Theorem' || d.tag === 'Lemma');
  if (thms.length === 0) { body.innerHTML = '<div class="empty"><div class="empty-text">No proofs found</div></div>'; return; }

  let html = '';
  for (const decl of thms) {
    const proof = decl.proof;
    if (!proof || proof.length === 0) continue;

    html += `<div style="font-size:11px;font-weight:600;margin:6px 0 4px">${esc(decl.name)}</div>`;
    proof.forEach((tac: Tactic, i: number) => {
      const isSorry = tac.tag === 'Sorry';
      const txt = prettyTactic(tac);
      const ghost = isSorry ? ghostSuggestion(decl) : '';
      const activeLlm = S.llmSuggestions[decl.name];

      html += `<div class="proof-step">
        <div class="step-num">${i + 1}</div>
        <div class="step-tactic${isSorry ? ' ghost-step' : ''}">${esc(txt)}</div>
        <div class="step-goal">
          ${isSorry ? `<button class="btn btn-sm ask-ai-btn" data-decl="${esc(decl.name)}" style="padding:0 4px;font-size:9px;margin-right:4px">${iconSparkles} Ask AI</button> <span style="color:var(--text-muted)">open</span>` : iconCheck}
        </div>
      </div>`;
      if (activeLlm) {
        html += `<div class="proof-step" style="opacity:0.8">
          <div class="step-num" style="background:none;font-size:10px;color:var(--accent)">${iconSparkles}</div>
          <div class="step-tactic ghost-step" style="color:var(--text)">${esc(activeLlm)}</div>
          <div class="step-goal" style="font-size:9px;color:var(--accent)">AI suggestion</div>
        </div>`;
      } else if (ghost) {
        html += `<div class="proof-step" style="opacity:0.45">
          <div class="step-num" style="background:none;font-size:10px">›</div>
          <div class="step-tactic ghost-step">${esc(ghost)}</div>
          <div class="step-goal" style="font-size:9px">heuristic</div>
        </div>`;
      }
    });
  }
  body.innerHTML = html || '<div class="empty"><div class="empty-text">No proof tactics found</div></div>';

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
      const decl = thms.find(d => d.name === declName);
      if (!decl) return;
      const statement = prettyTerm(decl.statement);
      const previousSteps = decl.proof.map(t => prettyTactic(t));
      try {
        const suggestion = await queryLLMForProofStep(key, declName, statement, previousSteps, { provider, model });
        S.llmSuggestions[declName] = suggestion;
        renderProofSteps();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        alert('LLM Failed: ' + msg);
        btn.textContent = prevText;
      }
    });
  });
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
