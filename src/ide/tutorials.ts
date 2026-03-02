// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Guided Tutorial System
// Interactive proof tutorials with AI hints
// ─────────────────────────────────────────────────────────────

export interface TutorialStep {
    instruction: string;         // What the user should do
    hint?: string;              // Hint if they're stuck
    expectedTactic?: string;    // Expected tactic (for validation)
    goalBefore: string;         // Goal state before this step
    goalAfter?: string;         // Goal state after (null = goals accomplished)
}

export interface Tutorial {
    id: string;
    title: string;
    description: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    category: string;
    latexSource: string;        // LaTeX to load into editor
    steps: TutorialStep[];
    completionMessage: string;
}

// ── Built-in Tutorials ──────────────────────────────────────

export const TUTORIALS: Tutorial[] = [
    {
        id: 'nat-add-zero',
        title: 'Addition by Zero',
        description: 'Prove that n + 0 = n for all natural numbers. A gentle introduction to Lean 4 tactics.',
        difficulty: 'beginner',
        category: 'Natural Numbers',
        latexSource: `\\begin{theorem}[Addition by Zero]
For all natural numbers $n$, $n + 0 = n$.
\\end{theorem}`,
        steps: [
            {
                instruction: 'The goal is to show n + 0 = n. In Lean 4, the tactic `simp` can simplify this automatically using known lemmas.',
                hint: 'Try: simp',
                expectedTactic: 'simp',
                goalBefore: '⊢ ∀ (n : ℕ), n + 0 = n',
                goalAfter: undefined,
            },
        ],
        completionMessage: '🎉 Great job! You proved your first theorem. The `simp` tactic is one of the most powerful tools in Lean 4 — it applies a large database of simplification lemmas.',
    },
    {
        id: 'nat-add-comm',
        title: 'Addition is Commutative',
        description: 'Prove that a + b = b + a using induction. Learn how to structure multi-step proofs.',
        difficulty: 'beginner',
        category: 'Natural Numbers',
        latexSource: `\\begin{theorem}[Commutativity of Addition]
For all natural numbers $a$ and $b$, $a + b = b + a$.
\\end{theorem}`,
        steps: [
            {
                instruction: 'Start with `intro a b` to introduce the universally quantified variables into the context.',
                hint: 'Type: intro a b',
                expectedTactic: 'intro a b',
                goalBefore: '⊢ ∀ (a b : ℕ), a + b = b + a',
                goalAfter: '⊢ a + b = b + a',
            },
            {
                instruction: 'Now use `omega` — a powerful tactic that solves linear arithmetic goals over natural numbers and integers.',
                hint: 'Try: omega',
                expectedTactic: 'omega',
                goalBefore: '⊢ a + b = b + a',
                goalAfter: undefined,
            },
        ],
        completionMessage: '🎉 Addition is commutative! The `omega` tactic handles linear arithmetic automatically. For more complex goals, you might need `ring` or `linarith`.',
    },
    {
        id: 'squares-nonneg',
        title: 'Squares are Non-Negative',
        description: 'Prove that x² ≥ 0 for all real numbers. An introduction to nonlinear arithmetic.',
        difficulty: 'intermediate',
        category: 'Real Analysis',
        latexSource: `\\begin{theorem}[Squares are Non-Negative]
For all real numbers $x$, $x^2 \\geq 0$.
\\end{theorem}`,
        steps: [
            {
                instruction: 'Introduce the variable x.',
                hint: 'Type: intro x',
                expectedTactic: 'intro x',
                goalBefore: '⊢ ∀ (x : ℝ), x ^ 2 ≥ 0',
                goalAfter: '⊢ x ^ 2 ≥ 0',
            },
            {
                instruction: 'Use `nlinarith` with the square non-negativity lemma. The key insight: x² = x * x, and you can use `sq_nonneg x` as a hint.',
                hint: 'Try: nlinarith [sq_nonneg x]',
                expectedTactic: 'nlinarith [sq_nonneg x]',
                goalBefore: '⊢ x ^ 2 ≥ 0',
                goalAfter: undefined,
            },
        ],
        completionMessage: '🎉 Excellent! `nlinarith` handles nonlinear arithmetic when given the right lemma hints. The `sq_nonneg` lemma states that any square is non-negative.',
    },
    {
        id: 'even-plus-even',
        title: 'Sum of Even Numbers',
        description: 'Prove that the sum of two even numbers is even. Practice with existential goals.',
        difficulty: 'intermediate',
        category: 'Number Theory',
        latexSource: `\\begin{theorem}[Even Plus Even]
If $m$ is even and $n$ is even, then $m + n$ is even.
\\end{theorem}`,
        steps: [
            {
                instruction: 'Introduce the variables and hypotheses. Even numbers are defined as ∃ k, n = 2 * k.',
                hint: 'Type: intro m n hm hn',
                expectedTactic: 'intro m n hm hn',
                goalBefore: '⊢ ∀ (m n : ℕ), Even m → Even n → Even (m + n)',
                goalAfter: 'hm : Even m\nhn : Even n\n⊢ Even (m + n)',
            },
            {
                instruction: 'Unfold the `Even` definition to access the existential witnesses.',
                hint: 'Try: obtain ⟨k, hk⟩ := hm',
                expectedTactic: 'obtain ⟨k, hk⟩ := hm',
                goalBefore: 'hm : Even m\nhn : Even n\n⊢ Even (m + n)',
                goalAfter: 'hk : m = 2 * k\nhn : Even n\n⊢ Even (m + n)',
            },
            {
                instruction: 'Do the same for the second hypothesis.',
                hint: 'Try: obtain ⟨l, hl⟩ := hn',
                expectedTactic: 'obtain ⟨l, hl⟩ := hn',
                goalBefore: 'hk : m = 2 * k\nhn : Even n\n⊢ Even (m + n)',
                goalAfter: 'hk : m = 2 * k\nhl : n = 2 * l\n⊢ Even (m + n)',
            },
            {
                instruction: 'Now provide the witness and close the goal with omega or ring.',
                hint: 'Try: exact ⟨k + l, by omega⟩',
                expectedTactic: 'exact ⟨k + l, by omega⟩',
                goalBefore: 'hk : m = 2 * k\nhl : n = 2 * l\n⊢ Even (m + n)',
                goalAfter: undefined,
            },
        ],
        completionMessage: '🎉 Beautifully done! You used `obtain` to destructure existential hypotheses and provided a concrete witness. This pattern of "unfold, extract, rebuild" is fundamental in formal proof.',
    },
    {
        id: 'fermat-little',
        title: "Fermat's Little Theorem",
        description: 'Explore the structure of a famous number theory proof. Learn about modular arithmetic in Lean 4.',
        difficulty: 'advanced',
        category: 'Number Theory',
        latexSource: `\\begin{theorem}[Fermat's Little Theorem]
Let $p$ be a prime number and $a$ an integer coprime to $p$.
Then $a^{p-1} \\equiv 1 \\pmod{p}$.
\\end{theorem}`,
        steps: [
            {
                instruction: "Fermat's Little Theorem is already in Mathlib as `ZMod.pow_card_sub_one_eq_one`. For a prime p and a ≠ 0 in ZMod p, we have a^(p-1) = 1.",
                hint: 'This theorem uses deep Mathlib machinery. Try: exact ZMod.pow_card_sub_one_eq_one hp ha',
                expectedTactic: 'exact ZMod.pow_card_sub_one_eq_one hp ha',
                goalBefore: '⊢ a ^ (p - 1) ≡ 1 [MOD p]',
                goalAfter: undefined,
            },
        ],
        completionMessage: "🎉 You've invoked one of Mathlib's deepest results! Fermat's Little Theorem is the foundation of RSA cryptography and many primality tests. In practice, most advanced theorems are proved by composing existing Mathlib lemmas.",
    },
];

// ── Tutorial UI Renderer ────────────────────────────────────

export interface TutorialState {
    activeTutorial: Tutorial | null;
    currentStep: number;
    completedSteps: boolean[];
    isComplete: boolean;
}

const tutorialState: TutorialState = {
    activeTutorial: null,
    currentStep: 0,
    completedSteps: [],
    isComplete: false,
};

export function getTutorialState(): TutorialState {
    return tutorialState;
}

export function startTutorial(id: string): Tutorial | null {
    const tutorial = TUTORIALS.find(t => t.id === id);
    if (!tutorial) return null;

    tutorialState.activeTutorial = tutorial;
    tutorialState.currentStep = 0;
    tutorialState.completedSteps = new Array(tutorial.steps.length).fill(false);
    tutorialState.isComplete = false;

    return tutorial;
}

export function advanceStep(): void {
    if (!tutorialState.activeTutorial) return;

    tutorialState.completedSteps[tutorialState.currentStep] = true;
    tutorialState.currentStep++;

    if (tutorialState.currentStep >= tutorialState.activeTutorial.steps.length) {
        tutorialState.isComplete = true;
    }
}

export function resetTutorial(): void {
    tutorialState.activeTutorial = null;
    tutorialState.currentStep = 0;
    tutorialState.completedSteps = [];
    tutorialState.isComplete = false;
}

export function renderTutorialPanel(container: HTMLElement): void {
    if (!tutorialState.activeTutorial) {
        // Show tutorial catalog
        renderCatalog(container);
        return;
    }

    // Show active tutorial
    renderActiveTutorial(container);
}

function renderCatalog(container: HTMLElement): void {
    let html = `<div style="padding:8px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">📚 Guided Tutorials</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">
            Learn formal proofs step by step with AI hints.
        </div>`;

    const categories = [...new Set(TUTORIALS.map(t => t.category))];
    for (const cat of categories) {
        html += `<div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin:8px 0 4px">${cat}</div>`;
        const tutorials = TUTORIALS.filter(t => t.category === cat);
        for (const t of tutorials) {
            const diffColor = t.difficulty === 'beginner' ? 'var(--success)' : t.difficulty === 'intermediate' ? 'var(--warning)' : 'var(--error)';
            html += `<div class="tutorial-card" data-id="${t.id}" style="padding:8px;border:1px solid var(--border);border-radius:6px;margin-bottom:6px;cursor:pointer;transition:all 150ms">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="font-size:12px;font-weight:500">${t.title}</div>
                    <span style="font-size:9px;color:${diffColor};font-weight:600;text-transform:uppercase">${t.difficulty}</span>
                </div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${t.description}</div>
                <div style="font-size:9px;color:var(--text-muted);margin-top:4px">${t.steps.length} step${t.steps.length > 1 ? 's' : ''}</div>
            </div>`;
        }
    }

    html += `</div>`;
    container.innerHTML = html;

    // Bind click handlers
    container.querySelectorAll('.tutorial-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = (card as HTMLElement).dataset.id!;
            startTutorial(id);
            renderTutorialPanel(container);
            // Dispatch custom event so IDE can load the LaTeX
            window.dispatchEvent(new CustomEvent('tutorial-start', {
                detail: { tutorial: tutorialState.activeTutorial },
            }));
        });

        // Hover effect
        (card as HTMLElement).addEventListener('mouseenter', () => {
            (card as HTMLElement).style.background = 'var(--bg-hover)';
        });
        (card as HTMLElement).addEventListener('mouseleave', () => {
            (card as HTMLElement).style.background = '';
        });
    });
}

function renderActiveTutorial(container: HTMLElement): void {
    const t = tutorialState.activeTutorial!;
    const step = tutorialState.currentStep;
    const currentStep = step < t.steps.length ? t.steps[step] : null;

    let html = `<div style="padding:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:13px;font-weight:600">${t.title}</div>
            <button class="btn btn-sm tutorial-exit-btn" style="font-size:9px;padding:2px 6px">✕ Exit</button>
        </div>
        <div style="display:flex;gap:3px;margin-bottom:10px">`;

    // Progress dots
    for (let i = 0; i < t.steps.length; i++) {
        const color = tutorialState.completedSteps[i] ? 'var(--success)' : i === step ? 'var(--accent)' : 'var(--border)';
        html += `<div style="width:${100 / t.steps.length}%;height:4px;border-radius:2px;background:${color}"></div>`;
    }

    html += `</div>`;

    if (tutorialState.isComplete) {
        html += `<div style="background:var(--success-light);border-radius:8px;padding:12px;margin-bottom:8px">
            <div style="font-size:12px;color:var(--success);font-weight:600;margin-bottom:4px">Tutorial Complete!</div>
            <div style="font-size:11px;color:var(--text-secondary);line-height:1.5">${t.completionMessage}</div>
        </div>
        <button class="btn btn-sm tutorial-back-btn" style="width:100%;justify-content:center">← Back to Tutorials</button>`;
    } else if (currentStep) {
        html += `<div style="font-size:10px;color:var(--accent);font-weight:600;margin-bottom:4px">Step ${step + 1} of ${t.steps.length}</div>
        <div style="font-size:12px;line-height:1.5;margin-bottom:8px">${currentStep.instruction}</div>
        <div style="background:var(--bg-code);border-radius:6px;padding:8px;margin-bottom:8px">
            <div style="font-size:9px;color:var(--text-muted);margin-bottom:4px">Current goal:</div>
            <div style="font-size:11px;font-family:var(--font-mono);color:var(--text-code)">${currentStep.goalBefore}</div>
        </div>`;

        if (currentStep.hint) {
            html += `<details style="margin-bottom:8px">
                <summary style="font-size:10px;color:var(--accent);cursor:pointer;font-weight:500">💡 Need a hint?</summary>
                <div style="font-size:11px;color:var(--text-secondary);padding:4px 0;font-family:var(--font-mono)">${currentStep.hint}</div>
            </details>`;
        }

        html += `<button class="btn btn-sm btn-primary tutorial-advance-btn" style="width:100%;justify-content:center;font-size:11px">
            ${step < t.steps.length - 1 ? 'Next Step →' : 'Complete Tutorial 🎉'}
        </button>`;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Bind buttons
    const exitBtn = container.querySelector('.tutorial-exit-btn');
    if (exitBtn) {
        exitBtn.addEventListener('click', () => {
            resetTutorial();
            renderTutorialPanel(container);
        });
    }

    const advanceBtn = container.querySelector('.tutorial-advance-btn');
    if (advanceBtn) {
        advanceBtn.addEventListener('click', () => {
            advanceStep();
            renderTutorialPanel(container);
        });
    }

    const backBtn = container.querySelector('.tutorial-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            resetTutorial();
            renderTutorialPanel(container);
        });
    }
}
