// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Moogle / LeanSearch Integration
// Natural language Mathlib search via public APIs
// ─────────────────────────────────────────────────────────────

export interface MoogleResult {
    name: string;         // e.g. "Nat.add_zero"
    type: string;         // e.g. "∀ (n : ℕ), n + 0 = n"
    docstring?: string;   // Documentation string
    module: string;       // e.g. "Mathlib.Data.Nat.Basic"
    url?: string;         // Link to Mathlib docs
}

const MOOGLE_API = 'https://www.moogle.ai/api/search';
const LEANSEARCH_API = 'https://leansearch.net/api/search';

/**
 * Search Mathlib via Moogle (primary) with LeanSearch fallback.
 * Returns up to `limit` results.
 */
export async function searchMathlib(
    query: string,
    limit: number = 8,
): Promise<MoogleResult[]> {
    // Try Moogle first
    try {
        const results = await searchMoogle(query, limit);
        if (results.length > 0) return results;
    } catch { /* fall through to LeanSearch */ }

    // Fallback: LeanSearch
    try {
        return await searchLeanSearch(query, limit);
    } catch {
        return [];
    }
}

async function searchMoogle(query: string, limit: number): Promise<MoogleResult[]> {
    const resp = await fetch(MOOGLE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, num_results: limit }),
        signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) throw new Error(`Moogle ${resp.status}`);
    const data = await resp.json();

    return (data.data || []).map((item: Record<string, unknown>) => ({
        name: String(item.name || item.decl_name || ''),
        type: String(item.type || item.decl_type || ''),
        docstring: item.doc_string ? String(item.doc_string) : undefined,
        module: String(item.module || item.decl_module || ''),
        url: item.name ? `https://leanprover-community.github.io/mathlib4_docs/find/#doc/${item.name}` : undefined,
    })).filter((r: MoogleResult) => r.name);
}

async function searchLeanSearch(query: string, limit: number): Promise<MoogleResult[]> {
    const params = new URLSearchParams({ query, num_results: String(limit) });
    const resp = await fetch(`${LEANSEARCH_API}?${params}`, {
        signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) throw new Error(`LeanSearch ${resp.status}`);
    const data = await resp.json();

    return (data.results || data || []).slice(0, limit).map((item: Record<string, unknown>) => ({
        name: String(item.name || item.decl_name || ''),
        type: String(item.type || item.decl_type || ''),
        docstring: item.docstring ? String(item.docstring) : undefined,
        module: String(item.module || ''),
        url: item.name ? `https://leanprover-community.github.io/mathlib4_docs/find/#doc/${item.name}` : undefined,
    })).filter((r: MoogleResult) => r.name);
}
