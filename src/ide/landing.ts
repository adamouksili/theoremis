// ─────────────────────────────────────────────────────────────
// Theoremis · Landing Page
// Premium deep-tech hero with typing animation & routing
// ─────────────────────────────────────────────────────────────

/** Navigate from landing to IDE view */
export type NavigateCallback = () => void;

// ── Code typing animation data ──────────────────────────────

interface CodePhase {
  label: string;
  filename: string;
  lines: string[];
}

const CODE_PHASES: CodePhase[] = [
  {
    label: 'LaTeX Input',
    filename: 'fermat.tex',
    lines: [
      '<span class="kw">\\begin</span>{theorem}[Fermat\'s Little]',
      '  Let <span class="ty">$p$</span> be prime, <span class="ty">$a$</span> coprime to <span class="ty">$p$</span>.',
      '  Then <span class="fn">$a^{p-1} \\equiv 1$</span> <span class="op">(mod p)</span>.',
      '<span class="kw">\\end</span>{theorem}',
    ],
  },
  {
    label: 'λΠω IR',
    filename: 'ir.json',
    lines: [
      '{ <span class="ty">"tag"</span>: <span class="str">"Theorem"</span>,',
      '  <span class="ty">"name"</span>: <span class="str">"fermat_little"</span>,',
      '  <span class="ty">"statement"</span>: <span class="op">Π</span>(p : <span class="fn">Nat</span>),',
      '    <span class="fn">isPrime</span>(p) <span class="op">→</span> <span class="fn">pow</span>(a, p<span class="op">-</span><span class="num">1</span>) <span class="op">≡</span> <span class="num">1</span> }',
    ],
  },
  {
    label: 'Lean 4 Output',
    filename: 'Fermat.lean',
    lines: [
      '<span class="kw">theorem</span> <span class="fn">fermat_little</span>',
      '  (p : <span class="ty">ℕ</span>) (hp : <span class="ty">Nat.Prime</span> p)',
      '  (a : <span class="ty">ℤ</span>) (ha : <span class="fn">IsCoprime</span> a p) :',
      '  a ^ (p - <span class="num">1</span>) <span class="op">≡</span> <span class="num">1</span> [ZMOD p] := <span class="kw">by</span>',
      '    <span class="cm">exact</span> <span class="fn">ZMod.pow_card_sub_one_eq_one</span> ha',
    ],
  },
];

// ── Shell HTML ──────────────────────────────────────────────

export function landingShell(): string {
  return `
<div class="landing">

  <nav class="landing-nav">
    <div class="landing-nav-brand">
      <img src="/logo_transparent.png" alt="Theoremis" class="landing-nav-logo-img" />
      <div class="landing-nav-logo">Theoremis</div>
      <div class="landing-nav-tag">v0.1.0-alpha</div>
    </div>
    <div class="landing-nav-links">
      <a class="landing-nav-link" href="https://github.com/adamouksili/theoremis" target="_blank" rel="noopener">Source</a>
      <button class="landing-nav-link" data-scroll="features">Features</button>
      <button class="landing-nav-cta" id="nav-launch-ide">Open IDE</button>
    </div>
  </nav>

  <section class="landing-hero">
    <div class="landing-hero-content">
      <h1 class="landing-hero-title">
        Write proofs in LaTeX.<br/>
        Get <em>Lean&nbsp;4</em> scaffolding.
      </h1>
      <p class="landing-hero-sub">
        Theoremis translates informal mathematical prose into
        structured proof skeletons for Lean&nbsp;4, Coq, and
        Isabelle/HOL — a starting point for formal verification,
        not a finished proof.
      </p>
      <div class="landing-hero-actions">
        <button class="landing-btn-primary" id="btn-launch-ide">
          Open the Editor
        </button>
        <button class="landing-btn-secondary" id="btn-download-ide">
          View Source on GitHub
        </button>
      </div>
    </div>

    <div class="landing-code-showcase">
      <div class="landing-code-card">
        <div class="landing-code-header">
          <div class="landing-code-dots">
            <div class="landing-code-dot"></div>
            <div class="landing-code-dot"></div>
            <div class="landing-code-dot"></div>
          </div>
          <span class="landing-code-filename" id="code-filename">fermat.tex</span>
        </div>
        <div class="landing-code-body" id="code-body-landing"></div>
        <div class="landing-code-phase">
          <span class="phase-dot"></span>
          <span id="code-phase-label">LaTeX Input</span>
        </div>
      </div>
    </div>
  </section>

  <section class="landing-pipeline">
    <div class="landing-pipeline-title">Pipeline</div>
    <div class="landing-pipeline-steps">
      <div class="landing-pipeline-step">
        <div class="landing-pipeline-step-label">Parse</div>
        <div class="landing-pipeline-step-desc">LaTeX to Math-AST</div>
      </div>
      <div class="landing-pipeline-arrow">→</div>
      <div class="landing-pipeline-step">
        <div class="landing-pipeline-step-label">Formalize</div>
        <div class="landing-pipeline-step-desc">λΠω type theory IR</div>
      </div>
      <div class="landing-pipeline-arrow">→</div>
      <div class="landing-pipeline-step">
        <div class="landing-pipeline-step-label">Emit</div>
        <div class="landing-pipeline-step-desc">Lean 4 / Coq / Isabelle</div>
      </div>
      <div class="landing-pipeline-arrow">→</div>
      <div class="landing-pipeline-step">
        <div class="landing-pipeline-step-label">Test</div>
        <div class="landing-pipeline-step-desc">QuickCheck + Mutation</div>
      </div>
    </div>
  </section>

  <section class="landing-features" id="features">
    <div class="landing-features-title">Design Principles</div>

    <div class="landing-feature">
      <div class="landing-feature-title">Axiom Budget Tracking</div>
      <div class="landing-feature-desc">
        Toggle LEM, Choice, Funext, and more. Every emitted declaration
        tracks which axioms it needs — so you know exactly what your
        formalization assumes.
      </div>
    </div>

    <div class="landing-feature">
      <div class="landing-feature-title">One source, three backends</div>
      <div class="landing-feature-desc">
        Write once in LaTeX. Generate Lean 4 (Mathlib), Coq (Gallina),
        and Isabelle/HOL proof skeletons from the same intermediate
        representation. Proofs contain <code>sorry</code> placeholders
        for you to fill in.
      </div>
    </div>

    <div class="landing-feature">
      <div class="landing-feature-title">Counterexample Testing</div>
      <div class="landing-feature-desc">
        QuickCheck-style random testing and mutation analysis validate
        that your hypotheses are necessary — not that your theorem is
        proven. This is heuristic testing, not formal verification.
      </div>
    </div>

    <div class="landing-feature">
      <div class="landing-feature-title">LLM-Assisted Gap Filling</div>
      <div class="landing-feature-desc">
        When the parser can't resolve a hypothesis or tactic, structured
        LLM prompting suggests candidates — with explicit confidence
        scores so you know exactly what was inferred vs. parsed.
      </div>
    </div>
  </section>

  <section class="landing-trust">
    <div class="landing-trust-badges">
      <span class="landing-trust-badge">Built with TypeScript + Lean 4</span>
      <span class="landing-trust-badge">MIT Licensed</span>
      <span class="landing-trust-badge"><a href="https://github.com/adamouksili/theoremis" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">View on GitHub →</a></span>
    </div>
  </section>

  <section class="landing-founder">
    <div class="landing-founder-rule"></div>
    <p class="landing-founder-text">
      I'm <strong>Adam Ouksili</strong>, a Computer Science and Mathematics
      student at <strong>Rutgers University</strong>. I built Theoremis because
      I kept running into the same wall: beautiful proofs on paper that had no
      easy path to machine verification. The gap between what mathematicians
      <em>write</em> and what proof assistants <em>accept</em> felt unnecessary.
    </p>
    <p class="landing-founder-text">
      This project is my attempt to close that gap — to make formal verification
      something any mathematician or student can reach for, not just the handful
      who've spent years learning Lean syntax. It's still early, and there's a
      lot more to do.
    </p>
    <p class="landing-founder-sign">— Adam Ouksili</p>
  </section>

  <footer class="landing-footer">
    <span>Built on λΠω type theory</span>
    <span>·</span>
    <span>© ${new Date().getFullYear()} Theoremis</span>
  </footer>
</div>`;
}

// ── Typing animation ────────────────────────────────────────

let animationFrameId: ReturnType<typeof setTimeout> | null = null;

export function startTypingAnimation(): void {
  stopTypingAnimation();
  let phaseIdx = 0;
  let lineIdx = 0;
  let charIdx = 0;
  let isDeleting = false;
  let pauseCounter = 0;

  const CHAR_DELAY = 22;
  const LINE_DELAY = 180;
  const PHASE_PAUSE = 2200;
  const DELETE_SPEED = 8;

  const codeBody = document.getElementById('code-body-landing');
  const filenameEl = document.getElementById('code-filename');
  const phaseLabel = document.getElementById('code-phase-label');
  if (!codeBody) return;

  // Current rendered lines (HTML)
  let renderedLines: string[] = [];

  function render(): void {
    if (!codeBody) return;
    const html = renderedLines
      .map((l, i) => {
        const isCurrentLine = !isDeleting && i === lineIdx;
        return `<div class="landing-code-line">${l}${isCurrentLine ? '<span class="typing-cursor"></span>' : ''}</div>`;
      })
      .join('');
    codeBody.innerHTML = html;
  }

  function tick(): void {
    const phase = CODE_PHASES[phaseIdx];

    // Pause between phases
    if (pauseCounter > 0) {
      pauseCounter--;
      animationFrameId = setTimeout(tick, 50);
      return;
    }

    if (isDeleting) {
      // Fast delete all lines
      if (renderedLines.length > 0) {
        renderedLines.pop();
        render();
        animationFrameId = setTimeout(tick, DELETE_SPEED);
      } else {
        // Move to next phase
        isDeleting = false;
        phaseIdx = (phaseIdx + 1) % CODE_PHASES.length;
        lineIdx = 0;
        charIdx = 0;
        const nextPhase = CODE_PHASES[phaseIdx];
        if (filenameEl) filenameEl.textContent = nextPhase.filename;
        if (phaseLabel) phaseLabel.textContent = nextPhase.label;
        animationFrameId = setTimeout(tick, 300);
      }
      return;
    }

    // Typing current line char by char
    if (lineIdx < phase.lines.length) {
      const fullLine = phase.lines[lineIdx];
      // We type based on visible text length but insert HTML spans whole
      // For simplicity, reveal the full HTML line incrementally by text content
      const plainText = fullLine.replace(/<[^>]+>/g, '');
      if (charIdx <= plainText.length) {
        // Build partial HTML: reveal chars up to charIdx
        renderedLines[lineIdx] = revealHtml(fullLine, charIdx);
        render();
        charIdx++;
        animationFrameId = setTimeout(tick, CHAR_DELAY);
      } else {
        // Line complete, move to next line
        lineIdx++;
        charIdx = 0;
        if (lineIdx < phase.lines.length) {
          renderedLines.push('');
          animationFrameId = setTimeout(tick, LINE_DELAY);
        } else {
          // Phase complete, pause then delete
          pauseCounter = Math.round(PHASE_PAUSE / 50);
          animationFrameId = setTimeout(tick, 50);
          // After pause, start deleting
          setTimeout(() => { isDeleting = true; }, PHASE_PAUSE);
        }
      }
    }
  }

  // Init first phase
  if (filenameEl) filenameEl.textContent = CODE_PHASES[0].filename;
  if (phaseLabel) phaseLabel.textContent = CODE_PHASES[0].label;
  renderedLines = [''];
  tick();
}

export function stopTypingAnimation(): void {
  if (animationFrameId !== null) {
    clearTimeout(animationFrameId);
    animationFrameId = null;
  }
}

/**
 * Reveal `count` visible characters from an HTML string,
 * keeping tags intact (they don't count as visible chars).
 */
function revealHtml(html: string, count: number): string {
  let visible = 0;
  let result = '';
  let inTag = false;
  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (ch === '<') {
      inTag = true;
      result += ch;
    } else if (ch === '>') {
      inTag = false;
      result += ch;
    } else if (inTag) {
      result += ch;
    } else {
      if (visible < count) {
        result += ch;
        visible++;
      } else {
        break;
      }
    }
  }
  // Close any unclosed tags (simple approach: just return as-is, browser handles it)
  return result;
}

// ── Bind landing page events ────────────────────────────────

export function bindLanding(onLaunchIDE: NavigateCallback): void {
  const btnLaunch = document.getElementById('btn-launch-ide');
  const navLaunch = document.getElementById('nav-launch-ide');
  const btnDownload = document.getElementById('btn-download-ide');
  const scrollBtns = document.querySelectorAll<HTMLElement>('[data-scroll]');

  if (btnLaunch) btnLaunch.addEventListener('click', onLaunchIDE);
  if (navLaunch) navLaunch.addEventListener('click', onLaunchIDE);

  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      window.open('https://github.com/adamouksili/theoremis', '_blank', 'noopener');
    });
  }

  // Smooth scroll to features
  scrollBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.scroll ?? '');
      target?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  startTypingAnimation();
}
