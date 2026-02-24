// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Lean Bridge Client (Browser-side)
// Calls the local Lean bridge server to verify emitted code
// ─────────────────────────────────────────────────────────────

const BRIDGE_URL = 'http://localhost:9473';

export interface LeanVerifyResult {
    success: boolean;
    errors: LeanDiagnostic[];
    warnings: LeanDiagnostic[];
    elapsed: number;
}

export interface LeanDiagnostic {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning' | 'information';
}

export async function checkBridgeHealth(): Promise<{ available: boolean; version?: string }> {
    try {
        const res = await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
            const data = await res.json();
            return { available: true, version: data.lean };
        }
        return { available: false };
    } catch {
        return { available: false };
    }
}

export async function verifyLeanCode(code: string): Promise<LeanVerifyResult> {
    const res = await fetch(`${BRIDGE_URL}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: 'lean4' }),
        signal: AbortSignal.timeout(35_000),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Bridge error' }));
        return {
            success: false,
            errors: [{ line: 0, column: 0, message: err.error || 'Bridge returned error', severity: 'error' }],
            warnings: [],
            elapsed: 0,
        };
    }

    return await res.json() as LeanVerifyResult;
}

export function formatLeanDiagnostics(result: LeanVerifyResult): string {
    const lines: string[] = [];

    if (result.success) {
        lines.push(`[PASS] Lean 4 verification passed (${result.elapsed.toFixed(0)}ms)`);
    } else {
        lines.push(`[FAIL] Lean 4 verification failed (${result.elapsed.toFixed(0)}ms)`);
    }

    for (const err of result.errors) {
        lines.push(`  L${err.line}:${err.column} error: ${err.message}`);
    }
    for (const warn of result.warnings) {
        lines.push(`  L${warn.line}:${warn.column} ${warn.severity}: ${warn.message}`);
    }

    return lines.join('\n');
}
