// Vercel Serverless Function — Mathlib Search Proxy
// Bypasses CORS by proxying Moogle/LeanSearch requests server-side

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST with {query: "..."} body.' });
    }

    const body = req.body || {};
    const query = body.query;
    const num_results = body.num_results || 8;

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Missing query string in POST body' });
    }

    const MOOGLE_API = 'https://www.moogle.ai/api/search';
    const LEANSEARCH_API = 'https://leansearch.net/api/search';

    // Try Moogle first
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const moogleRes = await fetch(MOOGLE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, num_results }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

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
    } catch (e) {
        // Moogle failed, fall through to LeanSearch
    }

    // Fallback: LeanSearch
    try {
        const params = new URLSearchParams({ query, num_results: String(num_results) });
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 10000);

        const lsRes = await fetch(`${LEANSEARCH_API}?${params}`, {
            signal: controller2.signal,
        });
        clearTimeout(timeout2);

        if (lsRes.ok) {
            const data = await lsRes.json();
            const raw = Array.isArray(data) ? data : (data.results || []);
            const results = raw.slice(0, num_results).map((item) => ({
                name: String(item.name || item.decl_name || ''),
                type: String(item.type || item.decl_type || ''),
                docstring: item.docstring ? String(item.docstring) : undefined,
                module: String(item.module || ''),
            })).filter((r) => r.name);

            return res.status(200).json({ results });
        }
    } catch (e) {
        // LeanSearch also failed
    }

    return res.status(200).json({ results: [], message: 'No results from Moogle or LeanSearch' });
}
