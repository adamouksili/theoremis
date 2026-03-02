// ─────────────────────────────────────────────────────────────
// Theoremis  ·  API Documentation Page
// Clean, developer-focused reference for the Semantic Math API
// ─────────────────────────────────────────────────────────────

export function apiDocsShell(): string {
    return `<div class="landing api-docs">
  <nav class="landing-nav">
    <div class="landing-nav-brand">
      <img src="/logo_transparent.png" alt="Theoremis" class="landing-nav-logo-img">
      <span class="landing-nav-title">Theoremis</span>
    </div>
    <div class="landing-nav-links">
      <a href="#" class="landing-nav-link">Home</a>
      <a href="#playground" class="landing-nav-link">Playground</a>
      <a href="#api" class="landing-nav-link" style="color:var(--l-accent)">API</a>
      <a href="#classroom" class="landing-nav-link">Classroom</a>
      <a href="#ide" class="landing-nav-link">IDE</a>
    </div>
  </nav>

  <header class="api-hero">
    <div class="api-hero-badge">v0.2.0</div>
    <h1 class="api-hero-title">Semantic Math API</h1>
    <p class="api-hero-sub">
      Parse LaTeX into structured IR, emit to Lean 4 / Coq / Isabelle,
      and run QuickCheck-style analysis — in one HTTP call.
    </p>
    <div class="api-hero-base">
      <code>https://theoremis.com/api/v1</code>
    </div>
  </header>

  <section class="api-quickstart">
    <h2 class="api-section-title">Quick Start</h2>
    <div class="api-code-block">
      <div class="api-code-header">
        <span class="api-code-method post">POST</span>
        <span class="api-code-path">/api/v1/pipeline</span>
      </div>
      <pre class="api-code-body"><code>curl -X POST https://theoremis.com/api/v1/pipeline \\
  -H "Content-Type: application/json" \\
  -d '{
    "latex": "\\\\begin{theorem}\\nFor all $x \\\\in \\\\mathbb{R}$, $x^2 \\\\geq 0$.\\n\\\\end{theorem}"
  }'</code></pre>
    </div>
    <p class="api-note">
      No API key required for the free tier (100 req/day).
      For higher limits, include <code>Authorization: Bearer thm_...</code>
    </p>
  </section>

  <section class="api-endpoints">
    <h2 class="api-section-title">Endpoints</h2>

    ${endpointCard({
        method: 'POST',
        path: '/api/v1/parse',
        description: 'Parse LaTeX into a Math AST, compile to λΠω IR, and type-check.',
        body: `{
  "latex": "\\\\begin{theorem}...\\\\end{theorem}",
  "axiomBundle": "ClassicalMath"
}`,
        bodyFields: [
            { name: 'latex', type: 'string', required: true, desc: 'LaTeX document or fragment' },
            { name: 'axiomBundle', type: 'string', required: false, desc: 'Axiom bundle name (default: ClassicalMath)' },
        ],
        response: `{
  "ok": true,
  "tier": "free",
  "document": { "nodes": [...] },
  "ir": { "declarations": [...], "axiomBudget": [...] },
  "typeCheck": { "valid": true, "diagnostics": [] },
  "elapsed": 2.34
}`,
    })}

    ${endpointCard({
        method: 'POST',
        path: '/api/v1/emit',
        description: 'Transpile LaTeX to formal proof assistant code.',
        body: `{
  "latex": "\\\\begin{theorem}...\\\\end{theorem}",
  "axiomBundle": "ClassicalMath",
  "targets": ["lean4", "coq", "isabelle"]
}`,
        bodyFields: [
            { name: 'latex', type: 'string', required: true, desc: 'LaTeX document or fragment' },
            { name: 'axiomBundle', type: 'string', required: false, desc: 'Axiom bundle name' },
            { name: 'targets', type: 'string[]', required: false, desc: 'Emit targets (default: all three)' },
        ],
        response: `{
  "ok": true,
  "lean4": { "code": "theorem ...", "warnings": [] },
  "coq":   { "code": "Theorem ...", "warnings": [] },
  "isabelle": { "code": "theorem ...", "warnings": [] }
}`,
    })}

    ${endpointCard({
        method: 'POST',
        path: '/api/v1/analyze',
        description: 'Run QuickCheck-style random testing and mutation analysis on each theorem.',
        body: `{
  "latex": "\\\\begin{theorem}...\\\\end{theorem}",
  "axiomBundle": "ClassicalMath",
  "numTests": 1000
}`,
        bodyFields: [
            { name: 'latex', type: 'string', required: true, desc: 'LaTeX document or fragment' },
            { name: 'axiomBundle', type: 'string', required: false, desc: 'Axiom bundle name' },
            { name: 'numTests', type: 'number', required: false, desc: 'Number of random tests per theorem (max: 10,000)' },
        ],
        response: `{
  "ok": true,
  "theorems": [{
    "name": "thm_1",
    "tag": "Theorem",
    "statement": { ... },
    "quickCheck": { "passed": 1000, "failed": 0, "status": "pass" },
    "axioms": ["LEM", "choice"]
  }],
  "overall": {
    "totalDeclarations": 1,
    "theoremCount": 1,
    "typeCheckValid": true
  }
}`,
    })}

    ${endpointCard({
        method: 'POST',
        path: '/api/v1/pipeline',
        description: 'Full pipeline — parse, emit, and analyze in a single call.',
        body: `{
  "latex": "\\\\begin{theorem}...\\\\end{theorem}",
  "axiomBundle": "ClassicalMath"
}`,
        bodyFields: [
            { name: 'latex', type: 'string', required: true, desc: 'LaTeX document or fragment' },
            { name: 'axiomBundle', type: 'string', required: false, desc: 'Axiom bundle name' },
        ],
        response: `{
  "ok": true,
  "parse": { "document": {...}, "ir": {...}, "typeCheck": {...} },
  "emit": { "lean4": {...}, "coq": {...}, "isabelle": {...} },
  "analysis": { "theorems": [...], "overall": {...} }
}`,
    })}

    ${endpointCard({
        method: 'POST',
        path: '/api/v1/grade',
        description: 'Auto-grade a LaTeX submission with configurable rubric, QuickCheck, and structural comparison.',
        body: `{
  "latex": "\\\\begin{theorem}...\\\\end{theorem}",
  "rubric": {
    "axiomBundle": "ClassicalMath",
    "expectedTheorems": ["fermat_little"],
    "numTests": 500,
    "maxPoints": 100,
    "requireCleanEmission": false,
    "referenceSolution": "\\\\begin{theorem}..."
  },
  "studentId": "student_42"
}`,
        bodyFields: [
            { name: 'latex', type: 'string', required: true, desc: 'Student LaTeX submission' },
            { name: 'rubric', type: 'object', required: false, desc: 'Grading rubric (all fields optional)' },
            { name: 'rubric.expectedTheorems', type: 'string[]', required: false, desc: 'Expected theorem names' },
            { name: 'rubric.axiomBundle', type: 'string', required: false, desc: 'Axiom bundle for type-checking' },
            { name: 'rubric.numTests', type: 'number', required: false, desc: 'Number of QuickCheck tests (default 500)' },
            { name: 'rubric.maxPoints', type: 'number', required: false, desc: 'Maximum score (default 100)' },
            { name: 'rubric.requireCleanEmission', type: 'boolean', required: false, desc: 'Require clean Lean 4 emission' },
            { name: 'rubric.referenceSolution', type: 'string', required: false, desc: 'Reference LaTeX for structure comparison' },
            { name: 'studentId', type: 'string', required: false, desc: 'Student identifier for tracking' },
        ],
        response: `{
  "ok": true,
  "totalPoints": 87.5,
  "maxPoints": 100,
  "percentage": 87.5,
  "letterGrade": "B+",
  "theorems": [{ "name": "...", "quickCheckPassed": true, ... }],
  "breakdown": { "parsing": {...}, "typeCheck": {...}, "quickCheck": {...}, ... },
  "overallFeedback": ["Good submission. A few issues to address."]
}`,
    })}

    ${endpointCard({
        method: 'GET',
        path: '/api/v1/health',
        description: 'Health check and service metadata.',
        body: '',
        bodyFields: [],
        response: `{
  "ok": true,
  "service": "theoremis-api",
  "version": "0.1.0",
  "endpoints": { ... },
  "targets": ["lean4", "coq", "isabelle"],
  "axiomBundles": ["ClassicalMath", "Algebraic", ...]
}`,
    })}
  </section>

  <section class="api-bundles">
    <h2 class="api-section-title">Axiom Bundles</h2>
    <p class="api-bundles-desc">
      Each bundle defines which axioms are available during type-checking and emission.
      This controls what your formalization is allowed to assume.
    </p>
    <div class="api-bundles-grid">
      ${bundleCard('ClassicalMath', 'Full classical logic: LEM, Choice, Funext, Propext', 'Default')}
      ${bundleCard('Algebraic', 'Group, Ring, Field axioms with classical reasoning')}
      ${bundleCard('NumberTheory', 'Peano axioms, prime factorization, modular arithmetic')}
      ${bundleCard('Analysis', 'Real analysis: completeness, continuity, limits')}
      ${bundleCard('Topology', 'Topological spaces, continuity, compactness')}
      ${bundleCard('LinearAlgebra', 'Vector spaces, matrices, eigenvalues')}
      ${bundleCard('SetTheory', 'ZFC-style set theory axioms')}
      ${bundleCard('CategoryTheory', 'Categories, functors, natural transformations')}
    </div>
  </section>

  <section class="api-auth">
    <h2 class="api-section-title">Authentication</h2>
    <div class="api-auth-tiers">
      <div class="api-auth-tier">
        <div class="api-auth-tier-name">Free</div>
        <div class="api-auth-tier-desc">No API key required</div>
        <div class="api-auth-tier-limit">100 requests / day</div>
      </div>
      <div class="api-auth-tier pro">
        <div class="api-auth-tier-name">Pro</div>
        <div class="api-auth-tier-desc">Include <code>Authorization: Bearer thm_...</code></div>
        <div class="api-auth-tier-limit">10,000 requests / day</div>
      </div>
    </div>
  </section>

  <section class="api-errors">
    <h2 class="api-section-title">Error Codes</h2>
    <table class="api-error-table">
      <thead>
        <tr><th>Status</th><th>Meaning</th></tr>
      </thead>
      <tbody>
        <tr><td><code>400</code></td><td>Bad request — missing or invalid <code>latex</code> field</td></tr>
        <tr><td><code>401</code></td><td>Invalid API key</td></tr>
        <tr><td><code>405</code></td><td>Wrong HTTP method (use POST)</td></tr>
        <tr><td><code>413</code></td><td>Input too large (max 50,000 chars)</td></tr>
        <tr><td><code>500</code></td><td>Internal error — parser or type-checker failure</td></tr>
      </tbody>
    </table>
  </section>

  <footer class="landing-footer">
    <span>Built on λΠω type theory</span>
    <span>·</span>
    <span>© ${new Date().getFullYear()} Theoremis</span>
  </footer>
</div>`;
}

// ── Helpers ─────────────────────────────────────────────────

interface FieldDoc {
    name: string;
    type: string;
    required: boolean;
    desc: string;
}

interface EndpointConfig {
    method: string;
    path: string;
    description: string;
    body: string;
    bodyFields: FieldDoc[];
    response: string;
}

function endpointCard(cfg: EndpointConfig): string {
    const fieldsHtml = cfg.bodyFields.length > 0
        ? `<div class="api-endpoint-fields">
            <div class="api-field-header">Request Body</div>
            ${cfg.bodyFields.map(f =>
            `<div class="api-field">
                <code class="api-field-name">${f.name}</code>
                <span class="api-field-type">${f.type}</span>
                <span class="api-field-req">${f.required ? 'required' : 'optional'}</span>
                <span class="api-field-desc">${f.desc}</span>
            </div>`
        ).join('\n')}
           </div>`
        : '';

    return `
    <div class="api-endpoint">
      <div class="api-endpoint-header">
        <span class="api-code-method ${cfg.method.toLowerCase()}">${cfg.method}</span>
        <code class="api-endpoint-path">${cfg.path}</code>
      </div>
      <p class="api-endpoint-desc">${cfg.description}</p>
      ${fieldsHtml}
      ${cfg.body ? `
      <details class="api-endpoint-example">
        <summary>Example Request</summary>
        <pre class="api-code-body"><code>${cfg.body}</code></pre>
      </details>` : ''}
      <details class="api-endpoint-example">
        <summary>Example Response</summary>
        <pre class="api-code-body"><code>${cfg.response}</code></pre>
      </details>
    </div>`;
}

function bundleCard(name: string, desc: string, badge?: string): string {
    return `<div class="api-bundle-card">
      <div class="api-bundle-name">${name}${badge ? `<span class="api-bundle-badge">${badge}</span>` : ''}</div>
      <div class="api-bundle-desc">${desc}</div>
    </div>`;
}
