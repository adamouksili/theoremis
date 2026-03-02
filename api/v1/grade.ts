// ─────────────────────────────────────────────────────────────
// Theoremis API  ·  POST /api/v1/grade
// Auto-grade a LaTeX submission against a rubric
// ─────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { gradeSubmission } from '../../src/api/grader';

function validateKey(req: VercelRequest) {
    const auth = req.headers['authorization'] || '';
    const key = typeof auth === 'string' ? auth.replace('Bearer ', '').trim() : '';
    if (!key) return { valid: true, tier: 'free' as const, rateLimit: 20 };
    if (key.startsWith('thm_')) return { valid: true, tier: 'pro' as const, rateLimit: 5000 };
    return { valid: true, tier: 'free' as const, rateLimit: 20 };
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
        const { latex, rubric, studentId } = req.body || {};

        if (!latex || typeof latex !== 'string') {
            return res.status(400).json({
                error: 'Missing required field: latex (string)',
                usage: {
                    method: 'POST',
                    body: {
                        latex: '\\begin{theorem}...\\end{theorem}',
                        rubric: {
                            expectedTheorems: ['fermats_little'],
                            axiomBundle: 'NumberTheory',
                            requireTypeCheck: true,
                            numTests: 1000,
                            maxPoints: 100,
                        },
                        studentId: 'student_123',
                    },
                },
            });
        }

        if (latex.length > 100_000) {
            return res.status(413).json({ error: 'Input too large. Maximum 100,000 characters.' });
        }

        const result = gradeSubmission(latex, rubric ?? {}, studentId);

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
