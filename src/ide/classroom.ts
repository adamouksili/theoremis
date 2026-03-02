// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Classroom Page
// Interactive auto-grader for math proof submissions
// ─────────────────────────────────────────────────────────────

export function classroomShell(): string {
    return `<div class="landing classroom">
  <nav class="landing-nav">
    <div class="landing-nav-brand">
      <img src="/logo_transparent.png" alt="Theoremis" class="landing-nav-logo-img">
      <span class="landing-nav-title">Theoremis</span>
    </div>
    <div class="landing-nav-links">
      <a href="#" class="landing-nav-link">Home</a>
      <a href="#playground" class="landing-nav-link">Playground</a>
      <a href="#api" class="landing-nav-link">API</a>
      <a href="#classroom" class="landing-nav-link" style="color:var(--l-accent)">Classroom</a>
      <a href="#ide" class="landing-nav-link">IDE</a>
    </div>
    <button class="landing-nav-hamburger" id="nav-hamburger" aria-label="Menu">☰</button>
  </nav>

  <header class="cr-hero">
    <div class="cr-hero-badge">Beta</div>
    <h1 class="cr-hero-title">Proof Auto-Grader</h1>
    <p class="cr-hero-sub">
      Paste your LaTeX proof below and get instant feedback —
      type-checking, random testing, and a detailed grade breakdown.
    </p>
  </header>

  <section class="cr-workspace">
    <div class="cr-input-panel">
      <div class="cr-panel-header">
        <span class="cr-panel-title">LaTeX Submission</span>
        <select id="cr-bundle-select" class="cr-select">
          <option value="ClassicalMath" selected>Classical Math</option>
          <option value="NumberTheory">Number Theory</option>
          <option value="Algebraic">Algebraic</option>
          <option value="Analysis">Analysis</option>
          <option value="Topology">Topology</option>
          <option value="LinearAlgebra">Linear Algebra</option>
          <option value="SetTheory">Set Theory</option>
          <option value="CategoryTheory">Category Theory</option>
        </select>
      </div>
      <textarea id="cr-latex-input" class="cr-textarea" placeholder="\\begin{theorem}[Your Theorem]
For all $x \\in \\mathbb{R}$, $x^2 \\geq 0$.
\\end{theorem}

\\begin{proof}
Since $x^2 = x \\cdot x$, and the product of two reals
with the same sign is non-negative, we conclude $x^2 \\geq 0$.
\\end{proof}"></textarea>

      <div class="cr-rubric-section">
        <details class="cr-rubric-details">
          <summary>Rubric Settings (optional)</summary>
          <div class="cr-rubric-grid">
            <label class="cr-rubric-label">
              Expected Theorems
              <input id="cr-expected-thms" class="cr-input" type="text" placeholder="thm_1, fermats_little (comma-separated)">
            </label>
            <label class="cr-rubric-label">
              QuickCheck Tests
              <input id="cr-num-tests" class="cr-input" type="number" value="500" min="10" max="10000">
            </label>
            <label class="cr-rubric-label">
              Max Points
              <input id="cr-max-points" class="cr-input" type="number" value="100" min="1" max="1000">
            </label>
            <label class="cr-rubric-label cr-checkbox-label">
              <input id="cr-require-emission" type="checkbox"> Require clean Lean 4 emission
            </label>
          </div>
          <div class="cr-rubric-ref">
            <label class="cr-rubric-label">
              Reference Solution (optional)
              <textarea id="cr-reference" class="cr-textarea cr-textarea-sm" placeholder="Paste instructor's reference LaTeX here..."></textarea>
            </label>
          </div>
        </details>
      </div>

      <button id="cr-grade-btn" class="cr-grade-btn">Grade Submission</button>
    </div>

    <div class="cr-output-panel" id="cr-output-panel">
      <div class="cr-empty-state">
        <div class="cr-empty-icon">📐</div>
        <p>Submit LaTeX to see grade results</p>
      </div>
    </div>
  </section>

  <footer class="landing-footer">
    <span>Built on λΠω type theory</span>
    <span>·</span>
    <span>© ${new Date().getFullYear()} Theoremis</span>
  </footer>
</div>`;
}

// ── Bind classroom events ───────────────────────────────────

export function bindClassroom(): void {
    const gradeBtn = document.getElementById('cr-grade-btn');
    if (!gradeBtn) return;

    gradeBtn.addEventListener('click', async () => {
        const latexInput = document.getElementById('cr-latex-input') as HTMLTextAreaElement | null;
        const bundleSelect = document.getElementById('cr-bundle-select') as HTMLSelectElement | null;
        const outputPanel = document.getElementById('cr-output-panel');
        const expectedThms = document.getElementById('cr-expected-thms') as HTMLInputElement | null;
        const numTests = document.getElementById('cr-num-tests') as HTMLInputElement | null;
        const maxPoints = document.getElementById('cr-max-points') as HTMLInputElement | null;
        const requireEmission = document.getElementById('cr-require-emission') as HTMLInputElement | null;
        const reference = document.getElementById('cr-reference') as HTMLTextAreaElement | null;

        if (!latexInput || !outputPanel) return;

        const latex = latexInput.value.trim();
        if (!latex) {
            outputPanel.innerHTML = '<div class="cr-error">Please enter some LaTeX.</div>';
            return;
        }

        // Build rubric
        const rubric: Record<string, unknown> = {
            axiomBundle: bundleSelect?.value ?? 'ClassicalMath',
            numTests: parseInt(numTests?.value ?? '500', 10),
            maxPoints: parseInt(maxPoints?.value ?? '100', 10),
            requireCleanEmission: requireEmission?.checked ?? false,
            requireTypeCheck: true,
        };

        const expectedStr = expectedThms?.value.trim();
        if (expectedStr) {
            rubric.expectedTheorems = expectedStr.split(',').map(s => s.trim()).filter(Boolean);
        }

        const refStr = reference?.value.trim();
        if (refStr) {
            rubric.referenceSolution = refStr;
        }

        // Show loading
        outputPanel.innerHTML = '<div class="cr-loading"><div class="cr-spinner"></div> Grading...</div>';
        gradeBtn.setAttribute('disabled', 'true');

        try {
            const res = await fetch('/api/v1/grade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latex, rubric }),
            });

            const data = await res.json();
            if (!res.ok || !data.ok) {
                outputPanel.innerHTML = `<div class="cr-error">Error: ${data.error || 'Unknown error'}</div>`;
                return;
            }

            outputPanel.innerHTML = renderGradeReport(data);
        } catch (err) {
            outputPanel.innerHTML = `<div class="cr-error">Network error: ${err instanceof Error ? err.message : String(err)}</div>`;
        } finally {
            gradeBtn.removeAttribute('disabled');
        }
    });
}

// ── Render grade report ─────────────────────────────────────

function renderGradeReport(data: Record<string, unknown>): string {
    const percentage = data.percentage as number;
    const letter = data.letterGrade as string;
    const total = data.totalPoints as number;
    const max = data.maxPoints as number;
    const breakdown = data.breakdown as Record<string, { earned: number; possible: number; detail: string }>;
    const theorems = data.theorems as Array<Record<string, unknown>>;
    const feedback = data.overallFeedback as string[];
    const elapsed = data.elapsed as number;

    const gradeColor = percentage >= 90 ? '#4ade80' : percentage >= 80 ? '#facc15' : percentage >= 70 ? '#fb923c' : '#f87171';

    let html = `
    <div class="cr-report">
      <div class="cr-grade-header">
        <div class="cr-grade-circle" style="--grade-color: ${gradeColor}">
          <span class="cr-grade-letter">${letter}</span>
          <span class="cr-grade-pct">${percentage}%</span>
        </div>
        <div class="cr-grade-meta">
          <div class="cr-grade-score">${total} / ${max} points</div>
          <div class="cr-grade-time">Graded in ${elapsed}ms</div>
        </div>
      </div>

      <div class="cr-feedback">
        ${feedback.map((f: string) => `<p class="cr-feedback-item">${f}</p>`).join('')}
      </div>

      <div class="cr-breakdown">
        <h3 class="cr-section-title">Breakdown</h3>
        ${Object.entries(breakdown).map(([category, info]) => {
            const pct = info.possible > 0 ? (info.earned / info.possible) * 100 : 100;
            return `<div class="cr-breakdown-row">
              <span class="cr-breakdown-label">${capitalize(category)}</span>
              <div class="cr-breakdown-bar">
                <div class="cr-breakdown-fill" style="width: ${pct}%"></div>
              </div>
              <span class="cr-breakdown-score">${info.earned}/${info.possible}</span>
              <span class="cr-breakdown-detail">${info.detail}</span>
            </div>`;
        }).join('')}
      </div>`;

    if (theorems.length > 0) {
        html += `
      <div class="cr-theorems">
        <h3 class="cr-section-title">Theorem Details</h3>
        ${theorems.map((thm: Record<string, unknown>) => {
            const icon = (thm.quickCheckPassed as boolean) ? '✓' : '✗';
            const iconClass = (thm.quickCheckPassed as boolean) ? 'pass' : 'fail';
            const thmFeedback = thm.feedback as string[];
            return `<div class="cr-theorem-card">
              <div class="cr-theorem-header">
                <span class="cr-theorem-icon ${iconClass}">${icon}</span>
                <span class="cr-theorem-name">${thm.name}</span>
                <span class="cr-theorem-tag">${thm.tag}</span>
                <span class="cr-theorem-score">${thm.pointsEarned}/${thm.pointsPossible}</span>
              </div>
              ${thmFeedback.map((f: string) => `<p class="cr-theorem-feedback">${f}</p>`).join('')}
            </div>`;
        }).join('')}
      </div>`;
    }

    html += `</div>`;
    return html;
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
