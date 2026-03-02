// Vercel Serverless Function — Mathlib Search Proxy
// Bypasses CORS by proxying Moogle/LeanSearch requests server-side

const MOOGLE_API = 'https://www.moogle.ai/api/search';
const LEANSEARCH_API = 'https://leansearch.net/api/search';

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query, num_results = 8 } = req.body || {};
    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Missing query string' });
    }

    // Try Moogle first
    try {
        const moogleRes = await fetch(MOOGLE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, num_results }),
            signal: AbortSignal.timeout(10000),
        });

        if (moogleRes.ok) {
            const data = await moogleRes.json();
            const results = (data.data || []).map((item) => ({
                name: String(item.name || item.decl_name || ''),
                type: String(item.type || item.decl_type || ''),
                docstring: item.doc_string ? String(item.doc_string) : undefined,
                module: String(item.module || item.decl_module || ''),
            })).filter((r) => r.name);

            if (results.length > 0) {
                return res.status(200).json({ results });
            }
        }
    } catch (e) { /* fall through to LeanSearch */ }

    // Fallback: LeanSearch
    try {
        const params = new URLSearchParams({ query, num_results: String(num_results) });
        const lsRes = await fetch(`${LEANSEARCH_API}?${params}`, {
            signal: AbortSignal.timeout(10000),
        });

        if (lsRes.ok) {
            const data = await lsRes.json();
            const results = (data.results || data || []).slice(0, num_results).map((item) => ({
                name: String(item.name || item.decl_name || ''),
                type: String(item.type || item.decl_type || ''),
                docstring: item.docstring ? String(item.docstring) : undefined,
                module: String(item.module || ''),
            })).filter((r) => r.name);

            return res.status(200).json({ results });
        }
    } catch (e) { /* fall through */ }

    return res.status(200).json({ results: [] });
};
