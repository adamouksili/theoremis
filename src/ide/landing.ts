// ─────────────────────────────────────────────────────────────
// Theoremis · Landing Page
// Deep-tech hero with typing animation & routing
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
  <div class="scroll-progress" id="scroll-progress"></div>
  <canvas class="particle-canvas" id="particle-canvas"></canvas>

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
      <a class="landing-nav-link" href="#api">API</a>
      <button class="landing-nav-cta" id="nav-launch-ide">Open IDE</button>
    </div>
    <button class="landing-nav-hamburger" id="nav-hamburger" aria-label="Menu">☰</button>
  </nav>

  <section class="landing-hero">
    <div class="hero-aurora hero-aurora-1"></div>
    <div class="hero-aurora hero-aurora-2"></div>
    <div class="hero-aurora hero-aurora-3"></div>

    <div class="landing-hero-content" data-parallax="0.15">
      <h1 class="landing-hero-title" id="hero-title">
        Write math.<br/>Get proofs working in <em>Lean&nbsp;4</em>.
      </h1>
      <p class="landing-hero-sub">
        Parse LaTeX theorems, detect unnecessary hypotheses via mutation testing,
        emit Lean 4 / Coq / Isabelle scaffolding, and verify proofs through a
        live Lean bridge — all from your browser.
      </p>
      <div class="landing-hero-actions">
        <a class="landing-btn-primary" href="#ide" data-magnetic>
          Open IDE →
        </a>
      </div>
    </div>

    <div class="landing-code-showcase" data-parallax="-0.1">
      <div class="landing-code-border">
        <div class="landing-code-card" id="code-card" data-tilt>
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
    </div>
  </section>

  <section class="landing-pipeline" data-reveal>
    <div class="section-divider"></div>
    <div class="landing-pipeline-title">How It Works</div>
    <div class="landing-pipeline-steps">
      <div class="landing-pipeline-step" data-reveal data-reveal-delay="0">
        <div class="landing-pipeline-step-label">Write</div>
        <div class="landing-pipeline-step-desc">LaTeX or Lean 4</div>
      </div>
      <div class="landing-pipeline-arrow" data-reveal data-reveal-delay="150">→</div>
      <div class="landing-pipeline-step" data-reveal data-reveal-delay="200">
        <div class="landing-pipeline-step-label">Analyze</div>
        <div class="landing-pipeline-step-desc">λΠω type theory IR</div>
      </div>
      <div class="landing-pipeline-arrow" data-reveal data-reveal-delay="350">→</div>
      <div class="landing-pipeline-step" data-reveal data-reveal-delay="400">
        <div class="landing-pipeline-step-label">Suggest</div>
        <div class="landing-pipeline-step-desc">AI tactic hints</div>
      </div>
      <div class="landing-pipeline-arrow" data-reveal data-reveal-delay="550">→</div>
      <div class="landing-pipeline-step" data-reveal data-reveal-delay="600">
        <div class="landing-pipeline-step-label">Verify</div>
        <div class="landing-pipeline-step-desc">Lean 4 bridge</div>
      </div>
    </div>
  </section>

  <section class="landing-features" id="features">
    <div class="section-divider"></div>
    <div class="landing-features-title" data-reveal>Why Theoremis</div>

    <div class="landing-feature" data-reveal data-reveal-delay="0">
      <div class="landing-feature-title">Lean 4 First</div>
      <div class="landing-feature-desc">
        Deep integration with <strong>Lean 4</strong> and <strong>Mathlib</strong>.
        Auto-generated imports, Mathlib-aware type signatures, and
        real verification feedback through the Lean bridge — not just
        syntax highlighting.
      </div>
    </div>

    <div class="landing-feature" data-reveal data-reveal-delay="150">
      <div class="landing-feature-title">AI-Assisted Proof Writing</div>
      <div class="landing-feature-desc">
        LLM-powered tactic suggestions that understand your proof state.
        Multi-provider support (OpenAI, Anthropic, Gemini) with explicit
        confidence scores — so you always know what was AI-suggested
        vs. machine-verified.
      </div>
    </div>

    <div class="landing-feature" data-reveal data-reveal-delay="300">
      <div class="landing-feature-title">Axiom Budget Tracking</div>
      <div class="landing-feature-desc">
        Toggle LEM, Choice, Funext, and more. Every emitted declaration
        tracks which axioms it needs — so you know exactly what your
        formalization assumes.
      </div>
    </div>

    <div class="landing-feature" data-reveal data-reveal-delay="450">
      <div class="landing-feature-title">Hypothesis Testing</div>
      <div class="landing-feature-desc">
        QuickCheck-style random testing checks whether your hypotheses
        are necessary. Mutation analysis validates theorem structure.
        Hypothesis-aware filtering avoids false negatives on constrained theorems.
      </div>
    </div>

  </section>

  <section class="landing-tech" id="tech">
    <div class="section-divider"></div>
    <div class="landing-tech-title" data-reveal>Under the Hood</div>
    <div class="landing-tech-grid">
      <div class="landing-tech-item" data-reveal data-reveal-delay="0">
        <div class="landing-tech-label">IR</div>
        <div class="landing-tech-value">λΠω with 18 term variants, dependent types, universe polymorphism</div>
      </div>
      <div class="landing-tech-item" data-reveal data-reveal-delay="100">
        <div class="landing-tech-label">Type-Checker</div>
        <div class="landing-tech-value">Bidirectional inference with alpha-equivalence and axiom tracking</div>
      </div>
      <div class="landing-tech-item" data-reveal data-reveal-delay="200">
        <div class="landing-tech-label">Mutation</div>
        <div class="landing-tech-value">7 operators — drop, weaken, swap quantifier, perturb, change domain, negate, strengthen</div>
      </div>
      <div class="landing-tech-item" data-reveal data-reveal-delay="300">
        <div class="landing-tech-label">Evaluator</div>
        <div class="landing-tech-value">BigInt modular arithmetic with domain-aware random input generation</div>
      </div>
      <div class="landing-tech-item" data-reveal data-reveal-delay="400">
        <div class="landing-tech-label">Emitters</div>
        <div class="landing-tech-value">Lean 4 (Mathlib-aware), Coq, Isabelle/HOL — with sorry/admit placeholders</div>
      </div>
      <div class="landing-tech-item" data-reveal data-reveal-delay="500">
        <div class="landing-tech-label">Benchmark</div>
        <div class="landing-tech-value">100% F1 on hypothesis detection, 95.2% F1 on mutation detection (20 theorems)</div>
      </div>
    </div>
  </section>

  <section class="landing-trust" data-reveal>
    <div class="landing-trust-badges">
      <span class="landing-trust-badge" data-reveal data-reveal-delay="0" data-count="15000" data-suffix="+ Lines of TypeScript">15,000+ Lines of TypeScript</span>
      <span class="landing-trust-badge" data-reveal data-reveal-delay="100" data-count="593" data-suffix=" Tests Passing">593 Tests Passing</span>
      <span class="landing-trust-badge" data-reveal data-reveal-delay="200" data-count="100" data-suffix="% Hypothesis F1">100% Hypothesis F1</span>
      <span class="landing-trust-badge" data-reveal data-reveal-delay="300" data-count="3" data-suffix=" Proof Assistants">3 Proof Assistants</span>
      <span class="landing-trust-badge" data-reveal data-reveal-delay="400">Open Source · MIT</span>
    </div>
  </section>

  <section class="landing-founder" data-reveal>
    <div class="section-divider"></div>
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
        <a href="#api" class="landing-footer-link">API Docs</a>
      </div>
      <div class="landing-footer-col">
        <div class="landing-footer-heading">Open Source</div>
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
        const phase = CODE_PHASES[phaseIdx]!;

        // Pause between phases
        if (pauseCounter > 0) {
            pauseCounter--;
            if (pauseCounter === 0) isDeleting = true;
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
                const nextPhase = CODE_PHASES[phaseIdx]!;
                if (filenameEl) filenameEl.textContent = nextPhase.filename;
                if (phaseLabel) phaseLabel.textContent = nextPhase.label;
                animationFrameId = setTimeout(tick, 300);
            }
            return;
        }

        // Typing current line char by char
        if (lineIdx < phase.lines.length) {
            const fullLine = phase.lines[lineIdx]!;
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
                    pauseCounter = Math.round(PHASE_PAUSE / 50);
                    animationFrameId = setTimeout(tick, 50);
                }
            }
        }
    }

    // Init first phase
    if (filenameEl) filenameEl.textContent = CODE_PHASES[0]!.filename;
    if (phaseLabel) phaseLabel.textContent = CODE_PHASES[0]!.label;
    renderedLines = [''];
    tick();
}

export function stopTypingAnimation(): void {
    if (animationFrameId !== null) {
        clearTimeout(animationFrameId);
        animationFrameId = null;
    }
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
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

let cleanupFns: (() => void)[] = [];

export function bindLanding(onLaunchIDE: NavigateCallback): void {
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];

    const navLaunch = document.getElementById('nav-launch-ide');
    const hamburger = document.getElementById('nav-hamburger');
    const navLinks = document.querySelector('.landing-nav-links') as HTMLElement | null;
    const scrollBtns = document.querySelectorAll<HTMLElement>('[data-scroll]');

    if (navLaunch) navLaunch.addEventListener('click', onLaunchIDE);

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('open');
            hamburger.textContent = navLinks.classList.contains('open') ? '✕' : '☰';
        });
    }

    scrollBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.scroll ?? '');
            target?.scrollIntoView({ behavior: 'smooth' });
        });
    });

    startTypingAnimation();
    initScrollReveal();
    initNavScroll();
    initScrollProgress();
    initParticleCanvas();
    initHeroCharReveal();
    initTiltEffect();
    initMagneticButtons();
    initParallax();
    initCounters();
    initCursorSpotlight();
    initNavLinkUnderlines();
    initCardTiltAll();
    initSectionGlowPulse();
}

// ── Scroll-reveal with IntersectionObserver ─────────────────

function initScrollReveal(): void {
    const elements = document.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!elements.length) return;

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const el = entry.target as HTMLElement;
                    const delay = parseInt(el.dataset.revealDelay ?? '0', 10);
                    if (delay > 0) {
                        setTimeout(() => el.classList.add('revealed'), delay);
                    } else {
                        el.classList.add('revealed');
                    }
                    observer.unobserve(el);
                }
            }
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );

    elements.forEach((el) => observer.observe(el));
}

// ── Glassmorphism nav scroll state ──────────────────────────

function initNavScroll(): void {
    const nav = document.querySelector('.landing-nav');
    if (!nav) return;

    const onScroll = () => {
        if (window.scrollY > 20) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    cleanupFns.push(() => window.removeEventListener('scroll', onScroll));
    onScroll();
}

// ── Scroll progress bar ─────────────────────────────────────

function initScrollProgress(): void {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;

    const onScroll = () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? scrollTop / docHeight : 0;
        bar.style.transform = `scaleX(${progress})`;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    cleanupFns.push(() => window.removeEventListener('scroll', onScroll));
}

// ── Floating math-symbol particle canvas ────────────────────

function initParticleCanvas(): void {
    const canvas = document.getElementById('particle-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SYMBOLS = ['∀', '∃', 'λ', 'Π', '⊢', '∈', '≡', '→', '∧', '∨', '¬', '⊥', 'α', 'β', 'Σ', '∞'];
    const COUNT = 35;
    let w = 0;
    let h = 0;
    let rafId = 0;
    let mouseX = -1000;
    let mouseY = -1000;

    interface Particle {
        x: number;
        y: number;
        vx: number;
        vy: number;
        symbol: string;
        size: number;
        opacity: number;
        baseOpacity: number;
        rotation: number;
        rotationSpeed: number;
    }

    const particles: Particle[] = [];

    function resize(): void {
        w = canvas!.width = window.innerWidth;
        h = canvas!.height = window.innerHeight;
    }

    function spawnParticles(): void {
        particles.length = 0;
        for (let i = 0; i < COUNT; i++) {
            particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!,
                size: 12 + Math.random() * 16,
                opacity: 0,
                baseOpacity: 0.04 + Math.random() * 0.06,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.005,
            });
        }
    }

    const LINE_DIST = 160;

    function draw(): void {
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);

        // Draw constellation lines between nearby particles
        for (let i = 0; i < particles.length; i++) {
            const a = particles[i]!;
            for (let j = i + 1; j < particles.length; j++) {
                const b = particles[j]!;
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < LINE_DIST) {
                    const alpha = (1 - dist / LINE_DIST) * 0.04 * Math.min(a.opacity / a.baseOpacity, 1);
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = `rgba(201, 168, 108, ${alpha})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }

        // Draw lines from particles to mouse when close
        for (const p of particles) {
            const dx = p.x - mouseX;
            const dy = p.y - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 200) {
                const alpha = (1 - dist / 200) * 0.08;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(mouseX, mouseY);
                ctx.strokeStyle = `rgba(201, 168, 108, ${alpha})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }

        for (const p of particles) {
            // Fade in over time
            if (p.opacity < p.baseOpacity) p.opacity += 0.0005;

            // Mouse repulsion
            const dx = p.x - mouseX;
            const dy = p.y - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 200) {
                const force = (200 - dist) / 200;
                p.vx += (dx / dist) * force * 0.15;
                p.vy += (dy / dist) * force * 0.15;
            }

            // Damping
            p.vx *= 0.995;
            p.vy *= 0.995;

            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;

            // Wrap around
            if (p.x < -50) p.x = w + 50;
            if (p.x > w + 50) p.x = -50;
            if (p.y < -50) p.y = h + 50;
            if (p.y > h + 50) p.y = -50;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.font = `${p.size}px "IBM Plex Mono", monospace`;
            ctx.fillStyle = `rgba(201, 168, 108, ${p.opacity})`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.symbol, 0, 0);
            ctx.restore();
        }

        rafId = requestAnimationFrame(draw);
    }

    const onMouseMove = (e: MouseEvent) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    };

    resize();
    spawnParticles();
    rafId = requestAnimationFrame(draw);

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    cleanupFns.push(() => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', onMouseMove);
    });
}

// ── Character-level hero title reveal ───────────────────────

function initHeroCharReveal(): void {
    const title = document.getElementById('hero-title');
    if (!title) return;

    const html = title.innerHTML.trim();
    let charIndex = 0;
    const wrapped = html.replace(
        /(<[^>]+>)|(&[a-zA-Z]+;|&#\d+;)|(\s)|([^<&\s])/g,
        (
            _match,
            tag: string | undefined,
            entity: string | undefined,
            ws: string | undefined,
            char: string | undefined,
        ) => {
            if (tag) return tag;
            if (ws) return ws;
            const text = entity ?? char ?? '';
            if (!text) return '';
            const delay = charIndex * 20;
            charIndex++;
            return `<span class="hero-char" style="animation-delay:${delay}ms">${text}</span>`;
        },
    );
    title.innerHTML = wrapped;
}

// ── 3D tilt on code card ────────────────────────────────────

function initTiltEffect(): void {
    const card = document.getElementById('code-card');
    if (!card) return;
    const showcase = card.closest('.landing-code-showcase') as HTMLElement | null;
    if (!showcase) return;

    const onMove = (e: MouseEvent) => {
        const rect = showcase.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const tiltX = (y - 0.5) * -12;
        const tiltY = (x - 0.5) * 12;
        card.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    };

    const onLeave = () => {
        card.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.transform = 'rotateX(0) rotateY(0)';
        setTimeout(() => {
            card.style.transition = '';
        }, 600);
    };

    showcase.addEventListener('mousemove', onMove);
    showcase.addEventListener('mouseleave', onLeave);
    cleanupFns.push(() => {
        showcase.removeEventListener('mousemove', onMove);
        showcase.removeEventListener('mouseleave', onLeave);
    });
}

// ── Magnetic CTA buttons ────────────────────────────────────

function initMagneticButtons(): void {
    const btns = document.querySelectorAll<HTMLElement>('[data-magnetic]');

    btns.forEach((btn) => {
        const onMove = (e: MouseEvent) => {
            const rect = btn.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = (e.clientX - cx) * 0.2;
            const dy = (e.clientY - cy) * 0.2;
            btn.style.transform = `translate(${dx}px, ${dy}px) scale(1.02)`;
        };

        const onLeave = () => {
            btn.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
            btn.style.transform = '';
            setTimeout(() => {
                btn.style.transition = '';
            }, 400);
        };

        btn.addEventListener('mousemove', onMove);
        btn.addEventListener('mouseleave', onLeave);
        cleanupFns.push(() => {
            btn.removeEventListener('mousemove', onMove);
            btn.removeEventListener('mouseleave', onLeave);
        });
    });
}

// ── Parallax depth on scroll ────────────────────────────────

function initParallax(): void {
    const elements = document.querySelectorAll<HTMLElement>('[data-parallax]');
    if (!elements.length) return;

    const onScroll = () => {
        const scrollY = window.scrollY;
        elements.forEach((el) => {
            const speed = parseFloat(el.dataset.parallax ?? '0');
            el.style.transform = `translateY(${scrollY * speed}px)`;
        });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    cleanupFns.push(() => window.removeEventListener('scroll', onScroll));
}

// ── Counting number animation on trust badges ───────────────

function initCounters(): void {
    const badges = document.querySelectorAll<HTMLElement>('[data-count]');
    if (!badges.length) return;

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const el = entry.target as HTMLElement;
                    const target = parseInt(el.dataset.count ?? '0', 10);
                    const suffix = el.dataset.suffix ?? '';
                    animateCount(el, target, suffix);
                    observer.unobserve(el);
                }
            }
        },
        { threshold: 0.5 },
    );

    badges.forEach((b) => observer.observe(b));
}

function animateCount(el: HTMLElement, target: number, suffix: string): void {
    const duration = 1500;
    const start = performance.now();

    function step(now: number): void {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * target);
        el.textContent = current.toLocaleString() + suffix;
        if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

// ── Cursor spotlight on cards ────────────────────────────────

function initCursorSpotlight(): void {
    const cards = document.querySelectorAll<HTMLElement>(
        '.landing-feature, .landing-tech-item, .landing-pipeline-step',
    );
    if (!cards.length) return;

    const onMove = (e: MouseEvent) => {
        for (const card of cards) {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--spot-x', `${x}px`);
            card.style.setProperty('--spot-y', `${y}px`);
        }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    cleanupFns.push(() => window.removeEventListener('mousemove', onMove));
}

// ── Nav link hover underline sweep ───────────────────────────

function initNavLinkUnderlines(): void {
    const links = document.querySelectorAll<HTMLElement>('.landing-nav-link');
    links.forEach((link) => {
        link.addEventListener('mouseenter', () => link.classList.add('nav-hover'));
        link.addEventListener('mouseleave', () => link.classList.remove('nav-hover'));
    });
}

// ── Subtle 3D tilt on all cards ──────────────────────────────

function initCardTiltAll(): void {
    const cards = document.querySelectorAll<HTMLElement>('.landing-feature, .landing-tech-item');

    cards.forEach((card) => {
        const onMove = (e: MouseEvent) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const tiltX = (y - 0.5) * -4;
            const tiltY = (x - 0.5) * 4;
            card.style.transform = `perspective(600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-4px)`;
        };

        const onLeave = () => {
            card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
            card.style.transform = '';
            setTimeout(() => {
                card.style.transition = '';
            }, 500);
        };

        card.addEventListener('mousemove', onMove);
        card.addEventListener('mouseleave', onLeave);
        cleanupFns.push(() => {
            card.removeEventListener('mousemove', onMove);
            card.removeEventListener('mouseleave', onLeave);
        });
    });
}

// ── Breathing glow pulse on section dividers & accent elements ──

function initSectionGlowPulse(): void {
    const dividers = document.querySelectorAll<HTMLElement>('.section-divider');
    dividers.forEach((d) => d.classList.add('glow-pulse'));

    // Add a subtle ambient mouse-follow glow to the page
    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.querySelector('.landing')?.appendChild(glow);

    const onMove = (e: MouseEvent) => {
        glow.style.left = `${e.clientX}px`;
        glow.style.top = `${e.clientY + window.scrollY}px`;
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    cleanupFns.push(() => {
        window.removeEventListener('mousemove', onMove);
        glow.remove();
    });
}
