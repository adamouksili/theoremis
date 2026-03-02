// ─────────────────────────────────────────────────────────────
// Theoremis API  ·  POST /api/v1/pipeline
// Full pipeline: LaTeX → Parse → TypeCheck → Emit → Analyze
// ─────────────────────────────────────────────────────────────

import { apiFullPipeline } from '../../src/api/pipeline.js';

function validateKey(req) {
    const auth = req.headers['authorization'] || '';
    const key = auth.replace('Bearer ', '').trim();
    if (!key) return { valid: true, tier: 'free', rateLimit: 100 };
    if (key.startsWith('thm_')) return { valid: true, tier: 'pro', rateLimit: 10000 };
    return { valid: true, tier: 'free', rateLimit: 100 };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    const auth = validateKey(req);
    if (!auth.valid) {
        return res.status(401).json({ error: 'Invalid API key.' });
    }

    try {
        const { latex, axiomBundle } = req.body || {};

        if (!latex || typeof latex !== 'string') {
            return res.status(400).json({
                error: 'Missing required field: latex (string)',
                usage: {
                    method: 'POST',
                    body: {
                        latex: '\\begin{theorem}...\\end{theorem}',
                        axiomBundle: 'ClassicalMath',
                    },
                },
            });
        }

        if (latex.length > 50000) {
            return res.status(413).json({ error: 'Input too large. Maximum 50,000 characters.' });
        }

        const result = apiFullPipeline(latex, axiomBundle);

        return res.status(200).json({
            ok: true,
            tier: auth.tier,
            ...result,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(500).json({ ok: false, error: message });
    }
}
