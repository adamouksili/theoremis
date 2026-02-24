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
  <div class="landing-bg"></div>
  <div class="landing-grid"></div>

  <nav class="landing-nav">
    <div class="landing-nav-brand">
      <img src="/logo_transparent.png" alt="Theoremis" class="landing-nav-logo-img" />
      <div class="landing-nav-logo">Theoremis</div>
      <div class="landing-nav-tag">v0.1.0-alpha</div>
    </div>
    <div class="landing-nav-links">
      <button class="landing-nav-link" data-scroll="features">Features</button>
      <a class="landing-nav-link" href="https://github.com/adamouksili/theoremis" target="_blank" rel="noopener">GitHub</a>
      <button class="landing-nav-cta" id="nav-launch-ide">Open IDE</button>
    </div>
  </nav>

  <section class="landing-hero">
    <div class="landing-hero-content">
      <div class="landing-hero-badge">
        <span class="badge-dot"></span>
        Formal verification for everyone
      </div>
      <h1 class="landing-hero-title">
        <span class="title-gradient">Theoremis</span>
      </h1>
      <p class="landing-hero-sub">
        <strong>Formal verification, democratized.</strong><br/>
        Natural language in. Infallible Lean&nbsp;4 logic out.
        Transform LaTeX proofs into machine-verified code across
        Lean&nbsp;4, Coq, and Isabelle — instantly.
      </p>
      <div class="landing-hero-actions">
        <button class="landing-btn-primary" id="btn-launch-ide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Use Theoremis Online
        </button>
        <button class="landing-btn-secondary" id="btn-download-ide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          View on GitHub
        </button>
      </div>
    </div>

    <div class="landing-code-showcase">
      <div class="landing-code-glow"></div>
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

  <section class="landing-features" id="features">
    <div class="landing-feature">
      <div class="landing-feature-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
      <div class="landing-feature-title">Machine-Verified</div>
      <div class="landing-feature-desc">Every theorem is compiled to dependent type theory and verified by Lean 4's kernel — zero trust, zero gaps.</div>
    </div>
    <div class="landing-feature">
      <div class="landing-feature-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      </div>
      <div class="landing-feature-title">Multi-Backend</div>
      <div class="landing-feature-desc">Emit to Lean 4, Coq, and Isabelle from a single LaTeX source. One proof, three verification ecosystems.</div>
    </div>
    <div class="landing-feature">
      <div class="landing-feature-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      </div>
      <div class="landing-feature-title">Instant Pipeline</div>
      <div class="landing-feature-desc">Parse → IR → Type-check → Emit in under 50ms. Counterexample engine and random testing run in parallel.</div>
    </div>
    <div class="landing-feature">
      <div class="landing-feature-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      </div>
      <div class="landing-feature-title">LLM-Assisted</div>
      <div class="landing-feature-desc">System 2 CoT prompting fills hypothesis gaps that regex alone can't parse — with built-in confidence scoring.</div>
    </div>
  </section>

  <section class="landing-founder">
    <div class="landing-founder-inner">
      <div class="landing-founder-avatar">A</div>
      <div class="landing-founder-body">
        <h2 class="landing-founder-heading">A note from the builder</h2>
        <p class="landing-founder-text">
          Hey — I'm <strong>Adam Ouksili</strong>, a Computer Science and Mathematics student at
          <strong>Rutgers University</strong>. I built Theoremis because I kept running into the
          same wall: beautiful proofs on paper that had no easy path to machine verification.
          The gap between what mathematicians <em>write</em> and what proof assistants
          <em>accept</em> felt unnecessary.
        </p>
        <p class="landing-founder-text">
          This project is my attempt to close that gap — to make formal verification
          something any mathematician or student can reach for, not just the handful of
          people who've spent years learning Lean syntax. It's still early, and there's a
          lot more to do, but I'm excited to keep building in the open.
        </p>
        <p class="landing-founder-text landing-founder-sign">
          — Adam Ouksili
        </p>
      </div>
    </div>
  </section>

  <footer class="landing-footer">
    <span>Built with λΠω type theory</span>
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
