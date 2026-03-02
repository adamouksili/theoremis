// ─────────────────────────────────────────────────────────────
// Theoremis API  ·  POST /api/v1/emit
// LaTeX → Lean 4 / Coq / Isabelle
// ─────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { apiEmit } from '../../src/api/pipeline';

const VALID_TARGETS = ['lean4', 'coq', 'isabelle'] as const;

function validateKey(req: VercelRequest) {
    const auth = req.headers['authorization'] || '';
    const key = typeof auth === 'string' ? auth.replace('Bearer ', '').trim() : '';
    if (!key) return { valid: true, tier: 'free' as const, rateLimit: 100 };
    if (key.startsWith('thm_')) return { valid: true, tier: 'pro' as const, rateLimit: 10000 };
    return { valid: true, tier: 'free' as const, rateLimit: 100 };
}

export default function handler(req: VercelRequest, res: VercelResponse) {
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
        const { latex, axiomBundle, targets } = req.body || {};

        if (!latex || typeof latex !== 'string') {
            return res.status(400).json({
                error: 'Missing required field: latex (string)',
                usage: {
                    method: 'POST',
                    body: {
                        latex: '\\begin{theorem}...\\end{theorem}',
                        axiomBundle: 'ClassicalMath',
                        targets: ['lean4', 'coq', 'isabelle'],
                    },
                },
            });
        }

        if (latex.length > 50_000) {
            return res.status(413).json({ error: 'Input too large. Maximum 50,000 characters.' });
        }

        if (targets && Array.isArray(targets)) {
            const validSet = new Set<string>(VALID_TARGETS);
            const invalid = targets.filter((t: string) => !validSet.has(t));
            if (invalid.length) {
                return res.status(400).json({
                    error: `Invalid targets: ${invalid.join(', ')}. Valid: ${VALID_TARGETS.join(', ')}`,
                });
            }
        }

        const result = apiEmit(latex, axiomBundle, targets);

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
