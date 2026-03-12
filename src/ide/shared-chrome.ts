// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Shared Nav & Footer
// Single source of truth for navigation and footer across all pages.
// ─────────────────────────────────────────────────────────────

/**
 * Render the unified navigation bar.
 * @param activePage - The current page ID to highlight (e.g. 'playground', 'changelog')
 */
export function sharedNav(activePage?: string): string {
    const link = (href: string, label: string, id: string) => {
        const style = id === activePage ? ' style="color:var(--l-accent)"' : '';
        return `<a href="${href}" class="landing-nav-link"${style}>${label}</a>`;
    };

    return `<nav class="landing-nav">
    <div class="landing-nav-brand">
      <a href="#" class="brand-link">
        <img src="/logo_transparent.png" alt="Theoremis" class="brand-logo-img">
        <span class="brand-name">Theoremis</span>
      </a>
    </div>
    <div class="landing-nav-links">
      ${link('#playground', 'Playground', 'playground')}
      ${link('#api', 'API', 'api')}
      <a href="#ide" class="landing-nav-cta">Open IDE</a>
    </div>
    <button class="landing-nav-hamburger" id="nav-hamburger" aria-label="Menu">☰</button>
  </nav>`;
}

/**
 * Render the unified 3-column footer.
 */
export function sharedFooter(): string {
    const year = new Date().getFullYear();
    return `<footer class="landing-footer">
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
      <span>© ${year} Theoremis</span>
      <span>·</span>
      <span>Built at Rutgers University</span>
    </div>
  </footer>`;
}
