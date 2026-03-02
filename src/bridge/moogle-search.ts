// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Moogle / LeanSearch Integration
// Uses /api/moogle proxy to bypass CORS restrictions
// ─────────────────────────────────────────────────────────────

export interface MoogleResult {
    name: string;         // e.g. "Nat.add_zero"
    type: string;         // e.g. "∀ (n : ℕ), n + 0 = n"
    docstring?: string;   // Documentation string
    module: string;       // e.g. "Mathlib.Data.Nat.Basic"
    url?: string;         // Link to Mathlib docs
}

/**
 * Search Mathlib via our Vercel proxy (/api/moogle).
 * The proxy handles Moogle (primary) + LeanSearch (fallback) server-side,
 * avoiding CORS issues in the browser.
 */
export async function searchMathlib(
    query: string,
    limit: number = 8,
): Promise<MoogleResult[]> {
    try {
        const resp = await fetch('/api/moogle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, num_results: limit }),
            signal: AbortSignal.timeout(15000),
        });

        if (!resp.ok) return [];

        const data = await resp.json();
        return (data.results || []).map((item: Record<string, unknown>) => ({
            name: String(item.name || ''),
            type: String(item.type || ''),
            docstring: item.docstring ? String(item.docstring) : undefined,
            module: String(item.module || ''),
            url: item.name
                ? `https://leanprover-community.github.io/mathlib4_docs/find/#doc/${item.name}`
                : undefined,
        }));
    } catch {
        return [];
    }
}
