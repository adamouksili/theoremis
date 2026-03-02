// ─────────────────────────────────────────────────────────────
// Theoremis API  ·  GET /api/v1/health
// Health check + service info
// ─────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

    if (req.method === 'OPTIONS') return res.status(204).end();

    return res.status(200).json({
        ok: true,
        service: 'theoremis-api',
        version: '0.1.0',
        docs: 'https://theoremis.com/api',
        endpoints: {
            parse: { method: 'POST', path: '/api/v1/parse', description: 'LaTeX → AST → IR → TypeCheck' },
            emit: { method: 'POST', path: '/api/v1/emit', description: 'LaTeX → Lean 4 / Coq / Isabelle' },
            analyze: { method: 'POST', path: '/api/v1/analyze', description: 'LaTeX → QuickCheck + analysis' },
            pipeline: { method: 'POST', path: '/api/v1/pipeline', description: 'Full pipeline (parse + emit + analyze)' },
            grade: { method: 'POST', path: '/api/v1/grade', description: 'Auto-grade LaTeX submission with rubric' },
            health: { method: 'GET', path: '/api/v1/health', description: 'This endpoint' },
        },
        targets: ['lean4', 'coq', 'isabelle'],
        axiomBundles: [
            'ClassicalMath', 'Algebraic', 'NumberTheory', 'Analysis',
            'Topology', 'LinearAlgebra', 'SetTheory', 'CategoryTheory',
        ],
    });
}
