// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Lean Bridge Client (Browser-side)
// Calls the Lean bridge server to verify emitted code.
// Supports both local (localhost:9473) and remote bridge URLs.
// ─────────────────────────────────────────────────────────────

const ENV_BRIDGE_URL = (import.meta.env?.VITE_THEOREMIS_BRIDGE_URL || '').trim();
const DEFAULT_PRODUCTION_BRIDGE_URL = 'https://lean.theoremis.com';

function sanitizeBridgeUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalhost)) {
            return '';
        }
        return parsed.origin + parsed.pathname.replace(/\/$/, '');
    } catch {
        return '';
    }
}

/** Get the bridge URL from localStorage, or fall back to sensible default */
function getBridgeUrl(): string {
    if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('theoremis-bridge-url');
        if (saved) {
            const sanitized = sanitizeBridgeUrl(saved);
            if (sanitized) return sanitized;
            localStorage.removeItem('theoremis-bridge-url');
        }
    }

    if (ENV_BRIDGE_URL) {
        const sanitized = sanitizeBridgeUrl(ENV_BRIDGE_URL);
        if (sanitized) return sanitized;
    }

    // In production use a stable bridge host; locally use localhost by default.
    if (
        typeof window !== 'undefined' &&
        (window.location.hostname === 'theoremis.com' || window.location.hostname === 'www.theoremis.com')
    ) {
        return DEFAULT_PRODUCTION_BRIDGE_URL;
    }

    return 'http://localhost:9473';
}

/** Set a custom bridge URL (persisted in localStorage) */
export function setBridgeUrl(url: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('theoremis-bridge-url', sanitizeBridgeUrl(url));
}

/** Get the current bridge URL */
export function currentBridgeUrl(): string {
    return getBridgeUrl();
}

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

export async function checkBridgeHealth(): Promise<{ available: boolean; version?: string; mathlib?: boolean }> {
    try {
        const res = await fetch(`${getBridgeUrl()}/health`, {
            signal: AbortSignal.timeout(5000),
            headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        if (res.ok) {
            const data = await res.json();
            return { available: true, version: data.lean, mathlib: !!data.mathlib };
        }
        return { available: false };
    } catch {
        return { available: false };
    }
}

export async function verifyLeanCode(code: string): Promise<LeanVerifyResult> {
    const res = await fetch(`${getBridgeUrl()}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
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

    const data: unknown = await res.json();
    return validateLeanResult(data);
}

function validateLeanResult(data: unknown): LeanVerifyResult {
    const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    return {
        success: typeof obj.success === 'boolean' ? obj.success : false,
        errors: Array.isArray(obj.errors) ? (obj.errors as LeanDiagnostic[]) : [],
        warnings: Array.isArray(obj.warnings) ? (obj.warnings as LeanDiagnostic[]) : [],
        elapsed: typeof obj.elapsed === 'number' ? obj.elapsed : 0,
    };
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
