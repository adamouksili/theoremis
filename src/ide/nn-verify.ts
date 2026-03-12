// ─────────────────────────────────────────────────────────────
// Theoremis · NN Verify Page
// Interactive neural network safety verification
// ─────────────────────────────────────────────────────────────

import { sharedNav, sharedFooter } from './shared-chrome';
import { parseNetworkJSON, parseSafetySpec } from '../nn/nn-parser';
import { verifyNN, formatInterval } from '../nn/nn-verifier';
import type { VerificationResult } from '../nn/nn-types';

// ── Default Example ─────────────────────────────────────────

const DEFAULT_NETWORK = `{
  "name": "safety_classifier",
  "layers": [
    {
      "weights": [
        [ 0.8, -0.5],
        [-0.3,  0.9],
        [ 0.6,  0.4]
      ],
      "biases": [0.1, -0.1, 0.05],
      "activation": "relu"
    },
    {
      "weights": [
        [ 0.7, -0.4, 0.3],
        [-0.5,  0.8, 0.2]
      ],
      "biases": [0.1, -0.05],
      "activation": "relu"
    },
    {
      "weights": [
        [0.6, -0.7]
      ],
      "biases": [0.15],
      "activation": "linear"
    }
  ]
}`;

const DEFAULT_SPEC = `// Input bounds: each dimension constrained to an interval
input [-1, 1], [-1, 1]

// Output safety constraints
// The network's single output must stay below 2.0
output [0] < 2.0`;

// ── Shell ───────────────────────────────────────────────────

export function nnVerifyShell(): string {
    return `<div class="landing nn-verify">
  ${sharedNav('nn-verify')}

  <main class="nnv-main">
    <div class="nnv-hero">
      <h1 class="nnv-hero-title">Neural Network Safety Verifier</h1>
      <p class="nnv-hero-sub">
        Prove that a ReLU network's output stays within safe bounds
        for <strong>every possible input</strong> — using formal mathematics, not empirical testing.
      </p>
    </div>

    <div class="nnv-explainer">
      <div class="nnv-explainer-card">
        <div class="nnv-explainer-icon">f(x)</div>
        <div class="nnv-explainer-title">Piecewise Linear</div>
        <div class="nnv-explainer-desc">ReLU networks are piecewise linear functions. Each activation pattern defines a linear region.</div>
      </div>
      <div class="nnv-explainer-card">
        <div class="nnv-explainer-icon">[a,b]</div>
        <div class="nnv-explainer-title">Bound Propagation</div>
        <div class="nnv-explainer-desc">Interval arithmetic propagates input bounds through each layer to over-approximate output ranges.</div>
      </div>
      <div class="nnv-explainer-card">
        <div class="nnv-explainer-icon">∀x</div>
        <div class="nnv-explainer-title">Mathematical Proof</div>
        <div class="nnv-explainer-desc">If the output bounds satisfy safety constraints, we have a proof — no testing required.</div>
      </div>
    </div>

    <div class="nnv-workspace">
      <div class="nnv-panel">
        <label class="nnv-label" for="nnv-network">Network Definition (JSON)</label>
        <textarea id="nnv-network" class="nnv-textarea" spellcheck="false" rows="20">${escHtml(DEFAULT_NETWORK)}</textarea>
      </div>
      <div class="nnv-panel">
        <label class="nnv-label" for="nnv-spec">Safety Specification</label>
        <textarea id="nnv-spec" class="nnv-textarea nnv-textarea-spec" spellcheck="false" rows="8">${escHtml(DEFAULT_SPEC)}</textarea>
        <button id="nnv-run" class="nnv-btn">Verify Safety</button>
      </div>
    </div>

    <div id="nnv-output" class="nnv-output">
      <div class="nnv-placeholder">Results will appear here after verification.</div>
    </div>
  </main>

  ${sharedFooter()}
</div>`;
}

// ── Bind ────────────────────────────────────────────────────

export function bindNNVerify(): void {
    const btn = document.getElementById('nnv-run') as HTMLButtonElement | null;
    const networkInput = document.getElementById('nnv-network') as HTMLTextAreaElement | null;
    const specInput = document.getElementById('nnv-spec') as HTMLTextAreaElement | null;
    const output = document.getElementById('nnv-output') as HTMLDivElement | null;

    if (!btn || !networkInput || !specInput || !output) return;

    btn.addEventListener('click', () => {
        const networkJSON = networkInput.value.trim();
        const specDSL = specInput.value.trim();

        if (!networkJSON) {
            output.innerHTML = '<div class="nnv-error">Please provide a network definition.</div>';
            return;
        }
        if (!specDSL) {
            output.innerHTML = '<div class="nnv-error">Please provide a safety specification.</div>';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Verifying…';
        output.innerHTML = '<div class="nnv-loading">Running formal verification…</div>';

        // Use requestAnimationFrame to let the UI update before heavy compute
        requestAnimationFrame(() => {
            try {
                const model = parseNetworkJSON(networkJSON);
                const spec = parseSafetySpec(specDSL, model.inputDim, model.outputDim);
                const result = verifyNN(model, spec);
                output.innerHTML = renderResult(result);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                output.innerHTML = `<div class="nnv-error">Error: ${escHtml(msg)}</div>`;
            } finally {
                btn.disabled = false;
                btn.textContent = 'Verify Safety';
            }
        });
    });

    // Auto-run with the default example
    btn.click();
}

// ── Result Rendering ────────────────────────────────────────

function renderResult(result: VerificationResult): string {
    const statusClass =
        result.status === 'safe' ? 'nnv-safe' :
            result.status === 'unsafe' ? 'nnv-unsafe' :
                'nnv-inconclusive';

    const statusIcon =
        result.status === 'safe' ? '✓' :
            result.status === 'unsafe' ? '✗' :
                '?';

    const statusLabel =
        result.status === 'safe' ? 'PROVEN SAFE' :
            result.status === 'unsafe' ? 'UNSAFE — VIOLATION FOUND' :
                'INCONCLUSIVE';

    let html = `<div class="nnv-result ${statusClass}">`;

    // Status badge
    html += `<div class="nnv-status-badge">
    <span class="nnv-status-icon">${statusIcon}</span>
    <span class="nnv-status-label">${statusLabel}</span>
    <span class="nnv-status-time">${result.timeMs.toFixed(1)}ms</span>
  </div>`;

    // Summary
    html += `<div class="nnv-summary">${escHtml(result.summary)}</div>`;

    // Counterexample details
    if (result.counterexample) {
        const cex = result.counterexample;
        html += `<div class="nnv-section">
      <div class="nnv-section-title">Counterexample</div>
      <div class="nnv-cex">
        <div class="nnv-cex-row">
          <span class="nnv-cex-label">Input:</span>
          <span class="nnv-cex-value">[${cex.input.map(v => v.toFixed(6)).join(', ')}]</span>
        </div>
        <div class="nnv-cex-row">
          <span class="nnv-cex-label">Output:</span>
          <span class="nnv-cex-value">[${cex.output.map(v => v.toFixed(6)).join(', ')}]</span>
        </div>
        <div class="nnv-cex-row">
          <span class="nnv-cex-label">Violated:</span>
          <span class="nnv-cex-value">${escHtml(cex.violatedConstraint)}</span>
        </div>
      </div>
    </div>`;
    }

    // Proof certificate (bounds table)
    if (result.certificate) {
        const cert = result.certificate;
        html += `<div class="nnv-section">
      <div class="nnv-section-title">Proof Certificate — Layer Bounds</div>
      <div class="nnv-bounds-table">`;

        for (let l = 0; l < cert.layerBounds.length; l++) {
            const layerName = l === cert.layerBounds.length - 1 ? 'Output' : `Hidden ${l + 1}`;
            html += `<div class="nnv-bounds-layer">
        <div class="nnv-bounds-layer-name">${layerName}</div>`;
            for (let n = 0; n < cert.layerBounds[l]!.length; n++) {
                const iv = cert.layerBounds[l]![n]!;
                html += `<div class="nnv-bounds-row">
          <span class="nnv-bounds-neuron">neuron[${n}]</span>
          <span class="nnv-bounds-interval">∈ ${formatInterval(iv)}</span>
        </div>`;
            }
            html += `</div>`;
        }

        html += `</div>`;

        if (cert.verifiedConstraints.length > 0) {
            html += `<div class="nnv-verified-list">
        <div class="nnv-section-title">Verified Constraints</div>`;
            for (const c of cert.verifiedConstraints) {
                html += `<div class="nnv-verified-item">✓ ${escHtml(c)}</div>`;
            }
            html += `</div>`;
        }
    }

    html += `</div>`;
    return html;
}

function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
