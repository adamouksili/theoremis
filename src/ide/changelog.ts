// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Changelog Page
// Professional product changelog showing active development
// ─────────────────────────────────────────────────────────────

import { sharedNav, sharedFooter } from './shared-chrome';

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
  ${sharedNav('changelog')}

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
    <h2 class="cl-subscribe-title">Follow Delivery Updates</h2>
    <p class="cl-subscribe-desc">For client delivery updates or release alerts, contact us directly.</p>
    <div class="cl-subscribe-form">
      <a href="mailto:adam@theoremis.com?subject=Theoremis%20Release%20Updates" class="cl-subscribe-btn">Email Theoremis</a>
      <a href="https://github.com/adamouksili/theoremis/releases" target="_blank" rel="noopener" class="cl-subscribe-btn">GitHub Releases</a>
    </div>
  </section>

  ${sharedFooter()}
</div>`;
}
