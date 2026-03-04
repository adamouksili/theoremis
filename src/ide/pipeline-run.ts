import { $, S } from './state';

export type StatusMode = 'idle' | 'processing' | 'done';
export type VerificationBadge = 'Draft' | 'Rejected' | 'Verified';

interface JobStatusResponse {
    ok: boolean;
    job: {
        id: string;
        status: 'queued' | 'running' | 'verified' | 'rejected' | 'timeout' | 'error';
        result?: {
            verified: boolean;
            status: 'verified' | 'rejected' | 'timeout' | 'error';
            diagnostics: Array<{
                file: string;
                line: number;
                column: number;
                severity: 'error' | 'warning' | 'info';
                message: string;
            }>;
            obligations: {
                sorryCount: number;
                admitCount: number;
                unsolvedGoals: number;
            };
            checker: {
                name: 'lean4';
                command: string;
                version: string | null;
                mathlib: string | null;
            };
            timings: {
                queuedMs: number;
                runMs: number;
                totalMs: number;
            };
            artifacts: {
                inputHash: string;
                outputHash: string;
                logHash: string;
                toolchainHash: string;
            };
        };
        error?: {
            code: string;
            message: string;
        };
    };
}

export interface IdePipelineController {
    run: () => Promise<void>;
    setStatus: (mode: StatusMode, label: string) => void;
    setDraft: (reason?: string) => void;
    clearResults: () => void;
    downloadOutput: () => void;
    loadSample: () => void;
    translateFromLatex: (latexInput?: string) => Promise<void>;
}

function verificationTone(badge: VerificationBadge): 'idle' | 'warn' | 'ok' {
    if (badge === 'Verified') return 'ok';
    if (badge === 'Rejected') return 'warn';
    return 'idle';
}

function setVerificationBadge(badge: VerificationBadge, subtitle: string): void {
    const icon = badge === 'Verified' ? '✓' : badge === 'Rejected' ? '!' : '∑';
    const tone = verificationTone(badge);
    const bar = $('summary-bar');
    bar.innerHTML = `
      <div class="summary-icon ${tone}">${icon}</div>
      <div class="summary-text">
        <div class="summary-title">${badge}</div>
        <div class="summary-sub">${subtitle}</div>
      </div>
      <div class="summary-pills">
        <div class="pill ${tone.toLowerCase()}">Lean Kernel</div>
      </div>
    `;
}

function renderDiagnosticsPanel(payload: JobStatusResponse['job']['result'] | null, rejectionMessage?: string): void {
    const codeSection = $('code-section');
    const tabs = $('code-tabs');
    const body = $('code-body');

    codeSection.style.display = '';
    tabs.innerHTML = '<button class="active">Verification Report</button>';

    if (!payload) {
        body.innerHTML = `<pre class="code-block">${rejectionMessage || 'No verification output available.'}</pre>`;
        return;
    }

    const lines: string[] = [];
    lines.push(`status: ${payload.status}`);
    lines.push(`verified: ${payload.verified}`);
    lines.push(`checker: ${payload.checker.version || 'Lean 4 (unknown version)'}`);
    lines.push(`timings: queued=${payload.timings.queuedMs}ms run=${payload.timings.runMs}ms total=${payload.timings.totalMs}ms`);
    lines.push(`obligations: sorry=${payload.obligations.sorryCount} admit=${payload.obligations.admitCount} unsolved=${payload.obligations.unsolvedGoals}`);
    lines.push(`artifacts: input=${payload.artifacts.inputHash.slice(0, 12)} output=${payload.artifacts.outputHash.slice(0, 12)} toolchain=${payload.artifacts.toolchainHash.slice(0, 12)}`);
    lines.push('');

    if (payload.diagnostics.length === 0) {
        lines.push('diagnostics: none');
    } else {
        lines.push('diagnostics:');
        for (const diag of payload.diagnostics) {
            lines.push(`- [${diag.severity}] ${diag.file}:${diag.line}:${diag.column} ${diag.message}`);
        }
    }

    body.innerHTML = `<pre class="code-block">${lines.join('\n')}</pre>`;
}

function setStatus(mode: StatusMode, label: string) {
    $('s-dot').className = 'status-dot' + (mode === 'processing' ? ' processing' : mode === 'done' ? ' active' : '');
    $('s-label').textContent = label;
}

function clearResults() {
    S.ir = null;
    S.tc = null;
    S.lean4 = null;
    S.coq = null;
    S.isabelle = null;
    S.report = null;
    S.randomReport = null;
    S.verification = null;
    S.verificationBadge = 'Draft';

    $('code-section').style.display = 'none';
    $('bottom-panels').style.display = 'none';
    $('s-stats').textContent = '';
    $('dep-graph').innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">Formal mode: graph unavailable</div>';

    setVerificationBadge('Draft', 'Edit Lean source, then run Kernel Verify');
    setStatus('idle', 'Draft');
}

function downloadOutput() {
    const content = S.source.trim();
    if (!content) return;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Main.lean';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function loadSample() {
    const sample = `theorem and_comm_demo (p q : Prop) : p ∧ q -> q ∧ p := by
  intro h
  exact And.intro h.right h.left`;

    const ed = $<HTMLTextAreaElement>('editor');
    ed.value = sample;
    S.source = sample;
    setVerificationBadge('Draft', 'Lean sample loaded. Run Kernel Verify to check.');
    setStatus('idle', 'Draft');
}

async function pollJob(id: string, timeoutMs: number): Promise<JobStatusResponse['job']> {
    const started = Date.now();

    while (true) {
        const res = await fetch(`/api/v2/jobs/${encodeURIComponent(id)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
            const payload = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(payload.error || `Unable to load verification job ${id}.`);
        }

        const payload = await res.json() as JobStatusResponse;
        if (!payload.ok || !payload.job) {
            throw new Error('Malformed job status response.');
        }

        if (payload.job.status !== 'queued' && payload.job.status !== 'running') {
            return payload.job;
        }

        if (Date.now() - started > timeoutMs) {
            throw new Error(`Verification job polling exceeded ${timeoutMs}ms.`);
        }

        await new Promise(resolve => setTimeout(resolve, 350));
    }
}

async function runVerification(): Promise<void> {
    const source = S.source.trim();
    if (!source) {
        clearResults();
        return;
    }

    setStatus('processing', 'Submitting verification job…');
    const verifyBtn = $('btn-verify');
    verifyBtn.textContent = 'Verifying…';
    verifyBtn.setAttribute('disabled', 'true');

    try {
        const request = {
            project: {
                files: [{ path: 'Main.lean', content: source }],
            },
            entryFile: 'Main.lean',
            timeoutMs: 30_000,
            memoryMb: 256,
            profile: 'strict',
        };

        const res = await fetch('/api/v2/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });

        if (!res.ok) {
            const payload = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(payload.error || 'Formal verification request failed.');
        }

        const payload = await res.json() as { job?: { id: string } };
        if (!payload.job?.id) {
            throw new Error('Verification API did not return a job id.');
        }

        setStatus('processing', 'Checking proof with Lean kernel…');
        const job = await pollJob(payload.job.id, 60_000);

        if (job.result) {
            S.verification = job.result;
            const badge: VerificationBadge = job.result.verified ? 'Verified' : 'Rejected';
            S.verificationBadge = badge;

            const subtitle = job.result.verified
                ? `Lean accepted proof (${job.result.timings.totalMs}ms).`
                : `Lean rejected proof (${job.result.obligations.sorryCount} sorry, ${job.result.obligations.unsolvedGoals} unsolved goals).`;

            setVerificationBadge(badge, subtitle);
            renderDiagnosticsPanel(job.result);
            $('s-stats').textContent = `diagnostics: ${job.result.diagnostics.length} · status: ${job.result.status}`;
            setStatus('done', badge);
        } else {
            const message = job.error?.message || `Verification ended with status '${job.status}'.`;
            S.verification = null;
            S.verificationBadge = 'Rejected';
            setVerificationBadge('Rejected', message);
            renderDiagnosticsPanel(null, message);
            $('s-stats').textContent = `job status: ${job.status}`;
            setStatus('idle', 'Rejected');
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        S.verification = null;
        S.verificationBadge = 'Rejected';
        setVerificationBadge('Rejected', message);
        renderDiagnosticsPanel(null, message);
        $('s-stats').textContent = '';
        setStatus('idle', 'Rejected');
    } finally {
        verifyBtn.textContent = 'Kernel Verify';
        verifyBtn.removeAttribute('disabled');
    }
}

async function translateFromLatex(latexInput?: string): Promise<void> {
    const latexSource = typeof latexInput === 'string'
        ? latexInput
        : (window.prompt('Paste LaTeX to translate into Lean draft (non-verified):', S.source) ?? '');
    if (!latexSource.trim()) return;

    setStatus('processing', 'Generating Lean draft from LaTeX…');

    try {
        const res = await fetch('/api/v2/translate/latex', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latex: latexSource }),
        });

        if (!res.ok) {
            const payload = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(payload.error || 'Draft translation failed.');
        }

        const payload = await res.json() as { leanDraft?: { code?: string } };
        const draft = String(payload.leanDraft?.code || '').trim();
        if (!draft) {
            throw new Error('Translator returned empty Lean draft.');
        }

        const ed = $<HTMLTextAreaElement>('editor');
        ed.value = draft;
        S.source = draft;
        S.verification = null;
        S.verificationBadge = 'Draft';
        setVerificationBadge('Draft', 'Draft translation generated. Run Kernel Verify to formally check it.');
        renderDiagnosticsPanel(null, 'Draft translation complete. No verification has been performed yet.');
        setStatus('idle', 'Draft');
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setVerificationBadge('Rejected', message);
        renderDiagnosticsPanel(null, message);
        setStatus('idle', 'Rejected');
    }
}

export function createPipelineController(): IdePipelineController {
    return {
        run: runVerification,
        setStatus,
        setDraft: (reason = 'Draft updated. Run Kernel Verify to check.') => {
            S.verification = null;
            S.verificationBadge = 'Draft';
            setVerificationBadge('Draft', reason);
            setStatus('idle', 'Draft');
        },
        clearResults,
        downloadOutput,
        loadSample,
        translateFromLatex,
    };
}
