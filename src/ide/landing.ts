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
      <a href="#" class="brand-link">
        <img src="/logo_transparent.png" alt="Theoremis" class="brand-logo-img" />
        <span class="brand-name">Theoremis</span>
      </a>
      <div class="landing-nav-tag">AI-Powered Proof IDE</div>
    </div>
    <div class="landing-nav-links">
      <a class="landing-nav-link" href="#playground">Playground</a>
      <a class="landing-nav-link" href="#nn-verify">NN Verify</a>
      <a class="landing-nav-link" href="#api">API</a>
      <a class="landing-nav-link" href="#classroom">Classroom</a>
      <a class="landing-nav-link" href="#pricing">Pricing</a>
      <a class="landing-nav-link" href="#changelog">Changelog</a>
      <button class="landing-nav-cta" id="nav-launch-ide">Open IDE</button>
    </div>
    <button class="landing-nav-hamburger" id="nav-hamburger" aria-label="Menu">☰</button>
  </nav>

  <section class="landing-hero">
    <div class="landing-hero-content">
      <h1 class="landing-hero-title">
        Write math.<br/>Get proofs working in <em>Lean&nbsp;4</em>.
      </h1>
      <p class="landing-hero-sub">
        Parse LaTeX theorems, detect unnecessary hypotheses via mutation testing,
        emit Lean 4 / Coq / Isabelle scaffolding, and verify proofs through a
        live Lean bridge — all from your browser.
      </p>
      <div class="landing-hero-actions">
        <a class="landing-btn-primary" href="#ide">
          Start Free →
        </a>
        <a class="landing-btn-secondary" href="#pricing">
          View Pricing
        </a>
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
    <div class="landing-pipeline-title">How It Works</div>
    <div class="landing-pipeline-steps">
      <div class="landing-pipeline-step">
        <div class="landing-pipeline-step-label">Write</div>
        <div class="landing-pipeline-step-desc">LaTeX or Lean 4</div>
      </div>
      <div class="landing-pipeline-arrow">→</div>
      <div class="landing-pipeline-step">
        <div class="landing-pipeline-step-label">Analyze</div>
        <div class="landing-pipeline-step-desc">λΠω type theory IR</div>
      </div>
      <div class="landing-pipeline-arrow">→</div>
      <div class="landing-pipeline-step">
        <div class="landing-pipeline-step-label">Suggest</div>
        <div class="landing-pipeline-step-desc">AI tactic hints</div>
      </div>
      <div class="landing-pipeline-arrow">→</div>
      <div class="landing-pipeline-step">
        <div class="landing-pipeline-step-label">Verify</div>
        <div class="landing-pipeline-step-desc">Lean 4 bridge</div>
      </div>
    </div>
  </section>

  <section class="landing-features" id="features">
    <div class="landing-features-title">Why Theoremis</div>

    <div class="landing-feature">
      <div class="landing-feature-title">Lean 4 First</div>
      <div class="landing-feature-desc">
        Deep integration with <strong>Lean 4</strong> and <strong>Mathlib</strong>.
        Auto-generated imports, Mathlib-aware type signatures, and
        real verification feedback through the Lean bridge — not just
        syntax highlighting.
      </div>
    </div>

    <div class="landing-feature">
      <div class="landing-feature-title">AI-Assisted Proof Writing</div>
      <div class="landing-feature-desc">
        LLM-powered tactic suggestions that understand your proof state.
        Multi-provider support (OpenAI, Anthropic, Gemini) with explicit
        confidence scores — so you always know what was AI-suggested
        vs. machine-verified.
      </div>
    </div>

    <div class="landing-feature">
      <div class="landing-feature-title">Axiom Budget Tracking</div>
      <div class="landing-feature-desc">
        Toggle LEM, Choice, Funext, and more. Every emitted declaration
        tracks which axioms it needs — so you know exactly what your
        formalization assumes.
      </div>
    </div>

    <div class="landing-feature">
      <div class="landing-feature-title">Hypothesis Testing</div>
      <div class="landing-feature-desc">
        QuickCheck-style random testing checks whether your hypotheses
        are necessary. Mutation analysis validates theorem structure.
        Hypothesis-aware filtering avoids false negatives on constrained theorems.
      </div>
    </div>

    <div class="landing-feature">
      <div class="landing-feature-title">Neural Network Safety</div>
      <div class="landing-feature-desc">
        Prove that ReLU networks stay within safe output bounds for
        <strong>every possible input</strong>. Formal verification via
        interval bound propagation and constraint satisfaction —
        not just empirical testing.
      </div>
    </div>
  </section>

  <section class="landing-tech" id="tech">
    <div class="landing-tech-title">Under the Hood</div>
    <div class="landing-tech-grid">
      <div class="landing-tech-item">
        <div class="landing-tech-label">IR</div>
        <div class="landing-tech-value">λΠω with 18 term variants, dependent types, universe polymorphism</div>
      </div>
      <div class="landing-tech-item">
        <div class="landing-tech-label">Type-Checker</div>
        <div class="landing-tech-value">Bidirectional inference with alpha-equivalence and axiom tracking</div>
      </div>
      <div class="landing-tech-item">
        <div class="landing-tech-label">Mutation</div>
        <div class="landing-tech-value">7 operators — drop, weaken, swap quantifier, perturb, change domain, negate, strengthen</div>
      </div>
      <div class="landing-tech-item">
        <div class="landing-tech-label">Evaluator</div>
        <div class="landing-tech-value">BigInt modular arithmetic with domain-aware random input generation</div>
      </div>
      <div class="landing-tech-item">
        <div class="landing-tech-label">Emitters</div>
        <div class="landing-tech-value">Lean 4 (Mathlib-aware), Coq, Isabelle/HOL — with sorry/admit placeholders</div>
      </div>
      <div class="landing-tech-item">
        <div class="landing-tech-label">Benchmark</div>
        <div class="landing-tech-value">100% F1 on hypothesis detection, 95.2% F1 on mutation detection (20 theorems)</div>
      </div>
    </div>
  </section>

  <section class="landing-trust">
    <div class="landing-trust-badges">
      <span class="landing-trust-badge">15,000+ Lines of TypeScript</span>
      <span class="landing-trust-badge">467 Tests Passing</span>
      <span class="landing-trust-badge">100% Hypothesis F1</span>
      <span class="landing-trust-badge">3 Proof Assistants</span>
      <span class="landing-trust-badge">Open Source · MIT</span>
    </div>
  </section>

  <section class="landing-waitlist">
    <div class="landing-waitlist-inner">
      <h2 class="landing-waitlist-title">Get early access to Pro features</h2>
      <p class="landing-waitlist-desc">Join the waitlist for priority verification, AI tactic hints, and private proofs.</p>
      <form class="landing-waitlist-form" action="https://formspree.io/f/placeholder" method="POST">
        <input type="email" name="email" class="landing-waitlist-input" placeholder="you@university.edu" required />
        <button type="submit" class="landing-waitlist-btn">Join Waitlist</button>
      </form>
      <p class="landing-waitlist-note">Free forever for open-source research. No spam.</p>
    </div>
  </section>

  <section class="landing-founder">
    <div class="landing-founder-rule"></div>
    <p class="landing-founder-text">
      I'm <strong>Adam Ouksili</strong>, a Computer Science and Mathematics
      student at <strong>Rutgers University</strong>. I built Theoremis because
      the gap between what mathematicians <em>write</em> and what proof assistants
      <em>accept</em> felt unnecessary — and no existing tool bridged it well.
    </p>
    <p class="landing-founder-sign">— Adam Ouksili</p>
  </section>

  <footer class="landing-footer">
    <div class="landing-footer-grid">
      <div class="landing-footer-col">
        <div class="landing-footer-heading">Product</div>
        <a href="#ide" class="landing-footer-link">IDE</a>
        <a href="#playground" class="landing-footer-link">Playground</a>
        <a href="#nn-verify" class="landing-footer-link">NN Verify</a>
        <a href="#classroom" class="landing-footer-link">Classroom</a>
        <a href="#api" class="landing-footer-link">API Docs</a>
      </div>
      <div class="landing-footer-col">
        <div class="landing-footer-heading">Company</div>
        <a href="#pricing" class="landing-footer-link">Pricing</a>
        <a href="#changelog" class="landing-footer-link">Changelog</a>
        <a href="https://github.com/adamouksili/theoremis" target="_blank" rel="noopener" class="landing-footer-link">GitHub</a>
      </div>
      <div class="landing-footer-col">
        <div class="landing-footer-heading">Stack</div>
        <span class="landing-footer-link">λΠω type theory</span>
        <span class="landing-footer-link">Lean 4 bridge</span>
        <span class="landing-footer-link">TypeScript</span>
      </div>
    </div>
    <div class="landing-footer-bottom">
      <span>© ${new Date().getFullYear()} Theoremis</span>
      <span>·</span>
      <span>Built at Rutgers University</span>
    </div>
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
  const navLaunch = document.getElementById('nav-launch-ide');
  const hamburger = document.getElementById('nav-hamburger');
  const navLinks = document.querySelector('.landing-nav-links') as HTMLElement | null;
  const scrollBtns = document.querySelectorAll<HTMLElement>('[data-scroll]');

  if (navLaunch) navLaunch.addEventListener('click', onLaunchIDE);

  // Mobile hamburger toggle
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      hamburger.textContent = navLinks.classList.contains('open') ? '✕' : '☰';
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
