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
    <button class="landing-nav-hamburger" id="nav-hamburger" aria-label="Menu">☰</button>
  </nav>

  <header class="api-hero">
    <div class="api-hero-badge">v2.0.0</div>
    <h1 class="api-hero-title">Formal Verification API</h1>
    <p class="api-hero-sub">
      Kernel-truth verification for Lean 4 projects.
      A proof is only verified when Lean accepts it with zero placeholders and no unresolved goals.
    </p>
    <div class="api-hero-base">
      <code>https://theoremis.com/api/v2</code>
    </div>
  </header>

  <section class="api-quickstart">
    <h2 class="api-section-title">Quick Start</h2>
    <div class="api-code-block">
      <div class="api-code-header">
        <span class="api-code-method post">POST</span>
        <span class="api-code-path">/api/v2/verify</span>
      </div>
      <pre class="api-code-body"><code>curl -X POST https://theoremis.com/api/v2/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "project": {
      "files": [{ "path": "Main.lean", "content": "theorem t : True := by trivial" }]
    },
    "entryFile": "Main.lean",
    "timeoutMs": 30000,
    "memoryMb": 256,
    "profile": "strict"
  }'</code></pre>
    </div>
    <p class="api-note">
      Verification is asynchronous. Submit to <code>/api/v2/verify</code>, then poll <code>/api/v2/jobs/:id</code>.
    </p>
  </section>

  <section class="api-endpoints">
    <h2 class="api-section-title">Formal Endpoints (v2)</h2>

    ${endpointCard({
        method: 'POST',
        path: '/api/v2/verify',
        description: 'Canonical verification endpoint. Schedules Lean kernel verification for a project bundle.',
        body: `{
  "project": {
    "files": [{ "path": "Main.lean", "content": "theorem t : True := by trivial" }]
  },
  "entryFile": "Main.lean",
  "timeoutMs": 30000,
  "memoryMb": 256,
  "profile": "strict"
}`,
        bodyFields: [
            { name: 'project.files[]', type: 'Array<{path, content}>', required: true, desc: 'Lean source files for the verification job' },
            { name: 'entryFile', type: 'string', required: true, desc: 'Entry Lean file that will be checked' },
            { name: 'timeoutMs', type: 'number', required: false, desc: 'Hard wall-time cap (server-clamped)' },
            { name: 'memoryMb', type: 'number', required: false, desc: 'Worker memory cap (server-clamped)' },
            { name: 'profile', type: '"strict" | "default"', required: false, desc: 'Verification profile' },
        ],
        response: `{
  "ok": true,
  "mode": "formal-verification",
  "verified": false,
  "job": { "id": "uuid", "status": "queued", "createdAt": "..." },
  "queue": { "depth": 0, "active": 1, "jobs": 42 }
}`,
    })}

    ${endpointCard({
        method: 'GET',
        path: '/api/v2/jobs/:id',
        description: 'Poll verification job status and final formal checker artifacts.',
        body: '',
        bodyFields: [],
        response: `{
  "ok": true,
  "mode": "formal-verification",
  "job": {
    "id": "uuid",
    "status": "verified",
    "result": {
      "verified": true,
      "status": "verified",
      "diagnostics": [],
      "obligations": { "sorryCount": 0, "admitCount": 0, "unsolvedGoals": 0 },
      "checker": { "name": "lean4", "version": "Lean 4.x", "mathlib": "..." },
      "timings": { "queuedMs": 4, "runMs": 41, "totalMs": 45 },
      "artifacts": { "inputHash": "...", "outputHash": "...", "logHash": "...", "toolchainHash": "..." }
    }
  }
}`,
    })}

    ${endpointCard({
        method: 'POST',
        path: '/api/v2/translate/latex',
        description: 'Generate draft Lean from LaTeX. Advisory only and never treated as verification.',
        body: `{
  "latex": "\\\\begin{theorem}For all $x$, $x=x$.\\\\end{theorem}"
}`,
        bodyFields: [
            { name: 'latex', type: 'string', required: true, desc: 'Input LaTeX source' },
        ],
        response: `{
  "ok": true,
  "mode": "draft-translation",
  "note": "Draft translation is advisory only and is not a formal verification result.",
  "leanDraft": { "code": "theorem ...", "warnings": [] }
}`,
    })}

    ${endpointCard({
        method: 'GET',
        path: '/api/v2/health',
        description: 'Formal runtime health, queue metrics, and endpoint metadata.',
        body: '',
        bodyFields: [],
        response: `{
  "ok": true,
  "service": "theoremis-formal-api",
  "version": "2.0.0",
  "runtime": { "ok": true },
  "queue": { "depth": 0, "active": 0, "jobs": 10 }
}`,
    })}
  </section>

  <section class="api-bundles">
    <h2 class="api-section-title">Legacy Analysis (v1)</h2>
    <p class="api-bundles-desc">
      v1 endpoints are still available for analysis and translation workflows.
      They are marked legacy and do not provide formal verification truth.
    </p>
    <div class="api-bundles-grid">
      ${bundleCard('/api/v1/parse', 'Legacy parse/typecheck endpoint', 'Legacy')}
      ${bundleCard('/api/v1/emit', 'Legacy transpilation endpoint', 'Legacy')}
      ${bundleCard('/api/v1/analyze', 'Legacy heuristic analysis endpoint', 'Legacy')}
      ${bundleCard('/api/v1/pipeline', 'Legacy combined parse/emit/analyze endpoint', 'Legacy')}
      ${bundleCard('/api/v1/grade', 'Legacy grading endpoint', 'Legacy')}
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
        <tr><td><code>400</code></td><td>Bad request — malformed verification payload</td></tr>
        <tr><td><code>401</code></td><td>Invalid API key</td></tr>
        <tr><td><code>405</code></td><td>Wrong HTTP method</td></tr>
        <tr><td><code>413</code></td><td>Project bundle too large</td></tr>
        <tr><td><code>429</code></td><td>Rate limit exceeded</td></tr>
        <tr><td><code>503</code></td><td>Formal runtime unavailable or not configured</td></tr>
      </tbody>
    </table>
  </section>

  <footer class="landing-footer">
    <span>Lean kernel-truth verification</span>
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
