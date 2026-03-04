import { emitLean4 } from '../emitters/lean4';
import { checkBridgeHealth, verifyLeanCode, formatLeanDiagnostics } from '../bridge/lean-client';
import { buildAxiomBundle } from './render/axioms';
import { $, esc, S } from './state';
import { iconShieldCheck } from './icons';
import type { StatusMode } from './pipeline-run';

export async function refreshBridgeStatus(): Promise<void> {
    const { available, version, mathlib } = await checkBridgeHealth();
    const dot = document.querySelector('#bridge-status .bridge-dot') as HTMLElement | null;
    const label = document.querySelector('#bridge-status .bridge-label') as HTMLElement | null;
    const leanBtn = document.getElementById('btn-lean') as HTMLButtonElement | null;
    if (available) {
        const mathlibTag = mathlib ? ' + Mathlib' : '';
        if (leanBtn) {
            leanBtn.style.display = '';
            leanBtn.title = `Lean 4 available: ${version || 'connected'}${mathlibTag}`;
        }
        if (dot) dot.className = 'bridge-dot online';
        if (label) label.textContent = mathlib ? 'Lean + Mathlib' : (version ? `Lean ${version}` : 'Connected');
        $('bridge-status').title = `Lean 4 Bridge: connected (${version || ''}${mathlibTag})`;
    } else {
        if (dot) dot.className = 'bridge-dot offline';
        if (label) label.textContent = 'Offline';
        $('bridge-status').title = 'Lean 4 Bridge: offline — run npm run bridge';
    }
}

export async function runLeanVerify(
    setStatus: (mode: StatusMode, label: string) => void,
): Promise<void> {
    if (!S.ir) {
        setStatus('idle', 'Run Verify first');
        return;
    }

    if (!S.lean4) {
        const bundle = buildAxiomBundle();
        S.lean4 = emitLean4({ ...S.ir, axiomBundle: bundle });
    }

    setStatus('processing', 'Verifying with Lean 4…');
    const leanBtn = document.getElementById('btn-lean') as HTMLButtonElement | null;
    if (leanBtn) {
        leanBtn.innerHTML = `${iconShieldCheck} Compiling…`;
        leanBtn.setAttribute('disabled', 'true');
    }

    try {
        const result = await verifyLeanCode(S.lean4.code);
        const summary = formatLeanDiagnostics(result);

        const insightsBody = $('insights-body');
        const statusBg = result.success ? 'var(--success-light)' : 'var(--error-light)';
        insightsBody.innerHTML = `<div style="margin-top:8px;padding:8px;border-radius:4px;background:${statusBg}"><pre style="margin:0;font-size:11px;white-space:pre-wrap">${esc(summary)}</pre></div>` + insightsBody.innerHTML;
        $('bottom-panels').style.display = '';

        if (result.success) {
            setStatus('done', `Lean 4: ✓ Verified (${result.elapsed.toFixed(0)}ms)`);
            if (leanBtn) leanBtn.innerHTML = `${iconShieldCheck} ✓ Verified`;
        } else {
            const errCount = result.errors.length;
            setStatus('idle', `Lean 4: ✗ ${errCount} error${errCount !== 1 ? 's' : ''}`);
            if (leanBtn) leanBtn.innerHTML = `${iconShieldCheck} ✗ ${errCount} errors`;
        }
    } catch {
        setStatus('idle', 'Lean bridge not running');
        const insightsBody = $('insights-body');
        insightsBody.innerHTML = `<div style="margin-top:8px;padding:8px;border-radius:4px;background:var(--error-light);font-size:11px">
      <strong>Lean bridge not running.</strong><br/>
      Start it with: <code>npm run bridge</code><br/>
      The bridge starts a local server on port 9473 that compiles Lean 4 code via the <code>lean</code> binary.
    </div>` + insightsBody.innerHTML;
        $('bottom-panels').style.display = '';
        if (leanBtn) leanBtn.innerHTML = `${iconShieldCheck} Lean 4`;
    }

    if (leanBtn) leanBtn.removeAttribute('disabled');
}
