// Vercel Serverless Function — Mathlib Search Proxy
// Bypasses CORS by proxying Moogle/LeanSearch requests server-side

import { applyCors, handlePreflight, authenticate, applyRateLimit, sendError, isDev } from './v1/_shared.js';

const MAX_NUM_RESULTS = 50;

export default async function handler(req, res) {
    applyCors(req, res, ['POST', 'OPTIONS']);

    if (handlePreflight(req, res)) return;

    if (req.method !== 'POST') {
        return sendError(res, 405, 'Method not allowed. Use POST with {query: "..."} body.');
    }

    // Authenticate (anonymous allowed in dev, required in prod)
    const auth = authenticate(req);
    if (!auth.valid) {
        return sendError(res, auth.status || 401, auth.error);
    }

    // Rate limit
    const rl = await applyRateLimit(req, res, auth);
    if (!rl.ok) {
        return sendError(res, rl.status, rl.error);
    }

    const body = req.body || {};
    const query = body.query;
    let num_results = body.num_results || 8;

    if (!query || typeof query !== 'string') {
        return sendError(res, 400, 'Missing query string in POST body');
    }

    // Validate and cap num_results
    num_results = Math.max(1, Math.min(Math.trunc(Number(num_results)) || 8, MAX_NUM_RESULTS));

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
