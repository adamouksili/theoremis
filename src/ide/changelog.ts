// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Changelog Page
// Professional product changelog showing active development
// ─────────────────────────────────────────────────────────────

interface ChangelogEntry {
    version: string;
    date: string;
    tag: 'launch' | 'feature' | 'improvement' | 'fix';
    title: string;
    items: string[];
}

const CHANGELOG: ChangelogEntry[] = [
    {
        version: '1.0.0',
        date: 'March 2026',
        tag: 'launch',
        title: 'Public Launch',
        items: [
            'Formal verification API (v2) with Lean 4 kernel-truth verification',
            'Interactive IDE with axiom budget tracking and dependency graph',
            'LaTeX → Lean 4 / Coq / Isabelle emission pipeline',
            'QuickCheck-style random testing for hypothesis necessity',
            'LLM-assisted tactic suggestions (OpenAI, Anthropic, GitHub)',
            'Classroom auto-grader with rubric-based scoring',
            'VS Code extension and GitHub Action for CI/CD',
            'REST API with free and pro tier rate limiting',
        ],
    },
    {
        version: '0.9.0',
        date: 'February 2026',
        tag: 'feature',
        title: 'Lean Bridge & Formal Verification',
        items: [
            'Live Lean 4 bridge for kernel-level proof verification',
            'Verification queue with configurable worker pool',
            'Proof obligation counting (sorry/admit detection)',
            'Verification artifact hashing for reproducibility',
            'Lean checker version detection and caching',
        ],
    },
    {
        version: '0.8.0',
        date: 'February 2026',
        tag: 'feature',
        title: 'IDE Feature Complete',
        items: [
            'Full IDE with code editor, results pane, and bottom panels',
            'Notation lens for proof step visualization',
            'Interactive dependency graph in sidebar',
            'Mathlib search integration via Moogle API',
            'Dark mode with complete color system',
            'Share proofs via URL encoding',
        ],
    },
    {
        version: '0.7.0',
        date: 'February 2026',
        tag: 'improvement',
        title: 'Code Quality Hardening',
        items: [
            'Exhaustive switch checks via assertNever utility',
            'Job GC for verification queue (prevents memory leaks)',
            'Fixed event listener leak in tutorial panel',
            'Checker cache reset for test isolation',
            'State reset function for route transitions',
            'ESLint + Prettier configuration',
            'Obligation counting now strips comments and strings',
        ],
    },
    {
        version: '0.6.0',
        date: 'January 2026',
        tag: 'feature',
        title: 'Mutation Engine & Counterexamples',
        items: [
            '7 mutation operators for hypothesis testing',
            'BigInt-accurate modular arithmetic evaluator',
            'Domain-aware random input generation (primes, coprime pairs)',
            'Configurable QuickCheck test count',
            'Per-hypothesis confidence scoring',
        ],
    },
    {
        version: '0.5.0',
        date: 'January 2026',
        tag: 'feature',
        title: 'Type-Checker & IR',
        items: [
            'λΠω intermediate representation with 18 term variants',
            'Bidirectional type inference with alpha-equivalence',
            'Capture-avoiding substitution and WHNF normalization',
            'Axiom tracking per declaration (LEM, Choice, Funext)',
            '8 axiom bundles (ClassicalMath, NumberTheory, Analysis, etc.)',
        ],
    },
];

const TAG_LABELS: Record<string, string> = {
    launch: '🚀 Launch',
    feature: '✨ Feature',
    improvement: '⚡ Improvement',
    fix: '🐛 Fix',
};

export function changelogShell(): string {
    return `<div class="landing changelog-page">
  <nav class="landing-nav">
    <div class="landing-nav-brand">
      <a href="#" class="brand-link">
        <img src="/logo_transparent.png" alt="Theoremis" class="brand-logo-img">
        <span class="brand-name">Theoremis</span>
      </a>
    </div>
    <div class="landing-nav-links">
      <a href="#" class="landing-nav-link">Home</a>
      <a href="#playground" class="landing-nav-link">Playground</a>
      <a href="#api" class="landing-nav-link">API</a>
      <a href="#pricing" class="landing-nav-link">Pricing</a>
      <a href="#changelog" class="landing-nav-link" style="color:var(--l-accent)">Changelog</a>
      <a href="#ide" class="landing-nav-link">IDE</a>
    </div>
    <button class="landing-nav-hamburger" id="nav-hamburger" aria-label="Menu">☰</button>
  </nav>

  <header class="cl-hero">
    <div class="cl-badge">Product Updates</div>
    <h1 class="cl-title">Changelog</h1>
    <p class="cl-subtitle">What's new in Theoremis — every feature, improvement, and fix.</p>
  </header>

  <section class="cl-timeline">
    ${CHANGELOG.map(entry => `
    <article class="cl-entry">
      <div class="cl-entry-meta">
        <span class="cl-entry-version">${entry.version}</span>
        <span class="cl-entry-date">${entry.date}</span>
        <span class="cl-entry-tag cl-tag-${entry.tag}">${TAG_LABELS[entry.tag]}</span>
      </div>
      <div class="cl-entry-content">
        <h2 class="cl-entry-title">${entry.title}</h2>
        <ul class="cl-entry-items">
          ${entry.items.map(item => `<li class="cl-entry-item">${item}</li>`).join('\n          ')}
        </ul>
      </div>
    </article>
    `).join('')}
  </section>

  <section class="cl-subscribe">
    <h2 class="cl-subscribe-title">Stay in the loop</h2>
    <p class="cl-subscribe-desc">Get notified when we ship new features.</p>
    <form class="cl-subscribe-form" action="https://formspree.io/f/placeholder" method="POST">
      <input type="email" name="email" class="cl-subscribe-input" placeholder="you@university.edu" required />
      <button type="submit" class="cl-subscribe-btn">Subscribe</button>
    </form>
  </section>

  <footer class="landing-footer">
    <span>Built on λΠω type theory</span>
    <span>·</span>
    <a href="https://github.com/adamouksili/theoremis" target="_blank" rel="noopener">GitHub</a>
    <span>·</span>
    <span>© ${new Date().getFullYear()} Theoremis</span>
  </footer>
</div>`;
}
