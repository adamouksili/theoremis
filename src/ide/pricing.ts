// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Services Page
// Engagement models for formal verification delivery
// ─────────────────────────────────────────────────────────────

import { sharedNav, sharedFooter } from './shared-chrome';

export function pricingShell(): string {
  return `<div class="landing pricing-page">
  ${sharedNav('pricing')}

  <header class="pricing-hero">
    <div class="pricing-badge">Services</div>
    <h1 class="pricing-title">Formal verification engagements</h1>
    <p class="pricing-subtitle">
      We operate as a formal verification startup: focused delivery, scoped outcomes,
      and direct support from proof engineers.
    </p>
  </header>

  <section class="pricing-grid">
    <div class="pricing-card">
      <div class="pricing-card-header">
        <div class="pricing-card-name">Verification Audit</div>
        <div class="pricing-card-price">2 weeks</div>
        <div class="pricing-card-period">fixed scope</div>
      </div>
      <div class="pricing-card-desc">Identify what to formalize first, where your specs are weak, and which properties can be proven quickly.</div>
      <ul class="pricing-features">
        <li class="pricing-feature"><span class="pricing-check">✓</span> Spec and risk triage workshop</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Prioritized property roadmap</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Prototype Lean 4 proofs</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Written findings and next-step plan</li>
      </ul>
      <a href="mailto:adam@theoremis.com?subject=Theoremis%20Verification%20Audit" class="pricing-cta pricing-cta-secondary">Request Audit</a>
    </div>

    <div class="pricing-card pricing-card-popular">
      <div class="pricing-popular-badge">Most Common</div>
      <div class="pricing-card-header">
        <div class="pricing-card-name">Acceleration Sprint</div>
        <div class="pricing-card-price">4-8 weeks</div>
        <div class="pricing-card-period">delivery sprint</div>
      </div>
      <div class="pricing-card-desc">End-to-end proof engineering for high-value guarantees with weekly milestones and artifact handoff.</div>
      <ul class="pricing-features">
        <li class="pricing-feature"><span class="pricing-check accent">✓</span> Dedicated proof engineer</li>
        <li class="pricing-feature"><span class="pricing-check accent">✓</span> Lean 4 implementation of target properties</li>
        <li class="pricing-feature"><span class="pricing-check accent">✓</span> CI verification integration</li>
        <li class="pricing-feature"><span class="pricing-check accent">✓</span> Internal enablement sessions</li>
        <li class="pricing-feature"><span class="pricing-check accent">✓</span> Weekly executive + technical reporting</li>
      </ul>
      <a href="mailto:adam@theoremis.com?subject=Theoremis%20Acceleration%20Sprint" class="pricing-cta pricing-cta-primary">Book Sprint</a>
    </div>

    <div class="pricing-card">
      <div class="pricing-card-header">
        <div class="pricing-card-name">Embedded Team</div>
        <div class="pricing-card-price">Quarterly</div>
        <div class="pricing-card-period">ongoing delivery</div>
      </div>
      <div class="pricing-card-desc">Continuous formal verification support for teams shipping safety- or correctness-critical systems.</div>
      <ul class="pricing-features">
        <li class="pricing-feature"><span class="pricing-check">✓</span> Shared proof ownership model</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Pull request review and theorem QA</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Standards, templates, and governance</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Ongoing onboarding for new engineers</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Priority incident response for proof regressions</li>
      </ul>
      <a href="mailto:adam@theoremis.com?subject=Theoremis%20Embedded%20Verification%20Team" class="pricing-cta pricing-cta-secondary">Talk to Us</a>
    </div>

    <div class="pricing-card">
      <div class="pricing-card-header">
        <div class="pricing-card-name">Enterprise Program</div>
        <div class="pricing-card-price">Custom</div>
        <div class="pricing-card-period">multi-team rollout</div>
      </div>
      <div class="pricing-card-desc">For organizations adopting formal methods as a strategic capability across products and teams.</div>
      <ul class="pricing-features">
        <li class="pricing-feature"><span class="pricing-check">✓</span> Program-level verification roadmap</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Custom integration and policy controls</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Security and compliance support</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Executive reporting and KPI tracking</li>
        <li class="pricing-feature"><span class="pricing-check">✓</span> Dedicated lead verifier</li>
      </ul>
      <a href="mailto:adam@theoremis.com?subject=Theoremis%20Enterprise%20Formal%20Verification%20Program" class="pricing-cta pricing-cta-secondary">Contact Sales</a>
    </div>
  </section>

  <section class="pricing-faq">
    <h2 class="pricing-faq-title">Frequently Asked Questions</h2>
    <div class="pricing-faq-grid">
      <div class="pricing-faq-item">
        <div class="pricing-faq-q">Do you only do services?</div>
        <div class="pricing-faq-a">Yes. Theoremis is focused on accelerating formal verification outcomes for clients. The open-source tooling remains available for teams that want to self-serve.</div>
      </div>
      <div class="pricing-faq-item">
        <div class="pricing-faq-q">What proof assistant do you support?</div>
        <div class="pricing-faq-a">Primary delivery is Lean 4 with kernel-checked verification. Coq and Isabelle are supported for code emission and migration planning.</div>
      </div>
      <div class="pricing-faq-item">
        <div class="pricing-faq-q">Can you work with our existing repo and CI?</div>
        <div class="pricing-faq-a">Yes. We can integrate verification checks into your current branch strategy, build system, and release gates.</div>
      </div>
      <div class="pricing-faq-item">
        <div class="pricing-faq-q">How do engagements start?</div>
        <div class="pricing-faq-a">Most teams begin with a Verification Audit, then move into a Sprint or Embedded Team model based on scope and urgency.</div>
      </div>
    </div>
  </section>

  <section class="pricing-cta-section">
    <h2 class="pricing-cta-heading">Need verification velocity now?</h2>
    <p class="pricing-cta-sub">Send a short summary of your system and target guarantees.</p>
    <div class="pricing-cta-actions">
      <a href="mailto:adam@theoremis.com?subject=Theoremis%20Formal%20Verification%20Engagement" class="landing-btn-primary">Contact Theoremis</a>
      <a href="#ide" class="landing-btn-secondary">Explore Tooling</a>
    </div>
  </section>

  ${sharedFooter()}
</div>`;
}
