// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Code Section Renderer (tabs + syntax highlight)
// ─────────────────────────────────────────────────────────────

import { $, esc, S } from '../state';
import { getRequiredImports } from '../../bridge/mathlib-db';

export function renderCodeSection(): void {
  const sec = $('code-section');
  sec.style.display = 'flex';

  const tabs = $('code-tabs');
  tabs.innerHTML = (['lean4', 'coq', 'isabelle'] as const).map(t => {
    const label = t === 'lean4' ? 'Lean 4' : t === 'coq' ? 'Coq' : 'Isabelle';
    return `<button class="code-tab${S.tab === t ? ' active' : ''}" data-t="${t}">${label}</button>`;
  }).join('');

  tabs.querySelectorAll('.code-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      S.tab = (btn as HTMLElement).dataset.t as typeof S.tab;
      tabs.querySelectorAll('.code-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('code-body').innerHTML = highlightedCode();
      bindCopyButtons();
    });
  });

  $('code-body').innerHTML = highlightedCode();
  bindCopyButtons();
}

function highlightedCode(): string {
  let src = S.tab === 'lean4' ? S.lean4?.code : S.tab === 'coq' ? S.coq?.code : S.isabelle?.code;
  if (!src) return '';

  // Inject Mathlib imports for Lean 4
  if (S.tab === 'lean4' && src) {
    const imports = getRequiredImports(src);
    if (imports.length > 0) {
      const importLines = imports.map(i => `import ${i}`).join('\n');
      src = `-- Suggested Mathlib imports:\n${importLines}\n\n${src}`;
    }
  }

  const highlighted = highlight(src, S.tab);
  const rawCode = src;

  return `<div style="position:relative"><button class="copy-btn" data-copy="${encodeURIComponent(rawCode)}" title="Copy to clipboard">📋 Copy</button><pre style="margin:0;overflow-x:auto">${highlighted}</pre></div>`;
}

/** Install copy button handlers on code body */
function bindCopyButtons(): void {
  document.querySelectorAll('.copy-btn[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const raw = decodeURIComponent((btn as HTMLElement).dataset.copy || '');
      navigator.clipboard.writeText(raw).then(() => {
        const el = btn as HTMLElement;
        el.textContent = '✓ Copied';
        setTimeout(() => { el.textContent = '📋 Copy'; }, 1500);
      }).catch(() => { /* fallback: do nothing */ });
    });
  });
}

export function highlight(code: string, lang: string): string {
  const escaped = esc(code);
  const rules = getHighlightRules(lang);
  // Tokenize in a single pass to avoid nested/broken spans
  return tokenHighlight(escaped, rules);
}

interface HighlightRule {
  pattern: RegExp;
  cls: string;
}

function getHighlightRules(lang: string): HighlightRule[] {
  if (lang === 'lean4') {
    return [
      { pattern: /--.*/, cls: 'sc' },
      { pattern: /\b(theorem|lemma|def|inductive|structure|where|import|open|section|namespace)\b/, cls: 'sk' },
      { pattern: /\b(by|sorry|exact|intro|intros|apply|rw|simp|omega|ring|cases|induction|have|let|show|aesop)\b/, cls: 'stac' },
      { pattern: /\b(Nat|Int|Real|Complex|Prop|Type|Bool|True|False|List|Set)\b/, cls: 'st' },
      { pattern: /\b\d+\b/, cls: 'sn' },
      { pattern: /[→↔∀∃∈≤≥Σλ⟨⟩∧∨¬≡]/, cls: 'so' },
    ];
  } else if (lang === 'coq') {
    return [
      { pattern: /\(\*[\s\S]*?\*\)/, cls: 'sc' },
      { pattern: /\b(Theorem|Lemma|Definition|Inductive|Proof|Qed|Require|Import|Open|Scope)\b/, cls: 'sk' },
      { pattern: /\b(intros|apply|rewrite|destruct|induction|simpl|auto|lia|admit|exact|ring)\b/, cls: 'stac' },
      { pattern: /\b(nat|Z|R|bool|Prop|Type)\b/, cls: 'st' },
      { pattern: /\b\d+\b/, cls: 'sn' },
    ];
  } else {
    return [
      { pattern: /\(\*[\s\S]*?\*\)/, cls: 'sc' },
      { pattern: /\b(theory|imports|begin|end|theorem|lemma|definition|datatype|where|assumes|shows|proof|qed|done)\b/, cls: 'sk' },
      { pattern: /\b(simp|auto|arith|sorry|rule|by)\b/, cls: 'stac' },
      { pattern: /\b(nat|int|real|bool)\b/, cls: 'st' },
      { pattern: /\b\d+\b/, cls: 'sn' },
    ];
  }
}

function tokenHighlight(text: string, rules: HighlightRule[]): string {
  // Build a combined regex with named groups
  const combined = rules.map((r, i) => `(?<g${i}>${r.pattern.source})`).join('|');
  const masterRe = new RegExp(combined, 'g');

  let result = '';
  let lastIndex = 0;

  for (const match of text.matchAll(masterRe)) {
    // Append text before this match
    result += text.slice(lastIndex, match.index);

    // Find which group matched
    let cls = '';
    for (let i = 0; i < rules.length; i++) {
      if (match.groups?.[`g${i}`] !== undefined) {
        cls = rules[i].cls;
        break;
      }
    }

    // Apply sorry highlighting within tactic spans
    const inner = match[0];
    if (cls === 'stac' && inner === 'sorry') {
      result += `<span class="sorry">${inner}</span>`;
    } else if (cls === 'stac' && inner === 'admit') {
      result += `<span class="sorry">${inner}</span>`;
    } else {
      result += `<span class="${cls}">${inner}</span>`;
    }

    lastIndex = match.index! + match[0].length;
  }

  // Append remaining text
  result += text.slice(lastIndex);
  return result;
}
