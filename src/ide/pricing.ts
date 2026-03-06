// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Pricing Page
// Startup-grade pricing tiers with feature comparison
// ─────────────────────────────────────────────────────────────

import { sharedNav, sharedFooter } from './shared-chrome';

export function pricingShell(): string {
  return `<div class="landing pricing-page">
  ${sharedNav('pricing')}

  <header class="pricing-hero">
    <div class="pricing-badge">Simple pricing</div>
    <h1 class="pricing-title">Start free. Scale as you grow.</h1>
    <p class="pricing-subtitle">
      From individual researchers to enterprise teams — choose the plan that fits
      your verification workflow.
    </p>
  </header>

  <section class="pricing-grid">
    <div class="pricing-card">
      <div class="pricing-card-header">
        <div class="pricing-card-name">Free</div>
        <div class="pricing-card-price">$0</div>
        <div class="pricing-card-period">forever</div>
      </div>
      <div class="pricing-card-desc">Perfect for students and individual researchers exploring formal verification.</div>
      <ul class="pricing-features">
        <li class="pricing-feature"><span class="pricing-check">✓</span> 50 verifications / day</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Public proofs</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Lean 4 / Coq / Isabelle emission</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> LaTeX parsing + type-checking</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Mutation-based hypothesis testing</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Community support</li>
      </ul>
      <a href="#ide" class="pricing-cta pricing-cta-secondary">Get Started Free</a>
    </div>

    <div class="pricing-card pricing-card-popular">
      <div class="pricing-popular-badge">Most Popular</div>
      <div class="pricing-card-header">
        <div class="pricing-card-name">Pro</div>
        <div class="pricing-card-price">$19</div>
        <div class="pricing-card-period">/ month</div>
      </div>
      <div class="pricing-card-desc">For serious mathematicians and proof engineers who need more power.</div>
      <ul class="pricing-features">
        <li class="pricing-feature"><span class="pricing-check accent">✓</span> Unlimited verifications</li>
        <li class="pricing-feature"><span class="pricing-check accent">✓</span> Private proofs</li>
        <li class="pricing-feature"><span class="pricing-check accent">✓</span> Priority verification queue</li>
        <li class="pricing-feature"><span class="pricing-check accent">✓</span> AI tactic suggestions</li>
        <li class="pricing-feature"><span class="pricing-check accent">✓</span> Proof version history</li>
        <li class="pricing-feature"><span class="pricing-check accent">✓</span> API access (10K req/day)</li>
        <li class="pricing-feature"><span class="pricing-check accent">✓</span> Email support</li>
      </ul>
      <a href="#waitlist" class="pricing-cta pricing-cta-primary">Join Waitlist</a>
    </div>

    <div class="pricing-card">
      <div class="pricing-card-header">
        <div class="pricing-card-name">Team</div>
        <div class="pricing-card-price">$49</div>
        <div class="pricing-card-period">/ seat / month</div>
      </div>
      <div class="pricing-card-desc">For university departments, research labs, and engineering teams.</div>
      <ul class="pricing-features">
        <li class="pricing-feature"><span class="pricing-check">✓</span> Everything in Pro</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Shared proof libraries</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Classroom auto-grading</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Team axiom bundles</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Admin dashboard</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> SSO (SAML)</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Priority support</li>
      </ul>
      <a href="#waitlist" class="pricing-cta pricing-cta-secondary">Join Waitlist</a>
    </div>

    <div class="pricing-card">
      <div class="pricing-card-header">
        <div class="pricing-card-name">Enterprise</div>
        <div class="pricing-card-price">Custom</div>
        <div class="pricing-card-period">let's talk</div>
      </div>
      <div class="pricing-card-desc">For organizations that need custom Lean environments and SLA guarantees.</div>
      <ul class="pricing-features">
        <li class="pricing-feature"><span class="pricing-check">✓</span> Everything in Team</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Custom Lean environments</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> SLA guarantee (99.9%)</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> On-prem deployment option</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Audit logs</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Custom integrations</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Dedicated support engineer</li>
      </ul>
      <a href="mailto:adam@theoremis.com" class="pricing-cta pricing-cta-secondary">Contact Sales</a>
    </div>
  </section>

  <section class="pricing-faq">
    <h2 class="pricing-faq-title">Frequently Asked Questions</h2>
    <div class="pricing-faq-grid">
      <div class="pricing-faq-item">
        <div class="pricing-faq-q">What counts as a verification?</div>
        <div class="pricing-faq-a">Each call to the Lean 4 kernel checker counts as one verification. LaTeX parsing, type-checking, and mutation testing are always free and unlimited.</div>
      </div>
      <div class="pricing-faq-item">
        <div class="pricing-faq-q">Can I use this for academic research?</div>
        <div class="pricing-faq-a">Absolutely. The Free tier is designed for individual researchers. University departments should look at the Team plan for shared libraries and classroom features.</div>
      </div>
      <div class="pricing-faq-item">
        <div class="pricing-faq-q">Is my proof data private?</div>
        <div class="pricing-faq-a">On the Free tier, proofs are public by default. Pro and above plans include private proofs with encrypted storage.</div>
      </div>
      <div class="pricing-faq-item">
        <div class="pricing-faq-q">Do you support Coq and Isabelle verification?</div>
        <div class="pricing-faq-a">Currently, kernel verification is Lean 4 only. Coq and Isabelle code emission is available on all plans, with full verification support coming in Q3 2026.</div>
      </div>
    </div>
  </section>

  <section class="pricing-cta-section">
    <h2 class="pricing-cta-heading">Ready to verify your proofs?</h2>
    <p class="pricing-cta-sub">Start with the free plan — no credit card required.</p>
    <div class="pricing-cta-actions">
      <a href="#ide" class="landing-btn-primary">Open IDE</a>
      <a href="#playground" class="landing-btn-secondary">Try Playground</a>
    </div>
  </section>

  ${sharedFooter()}
</div>`;
}
