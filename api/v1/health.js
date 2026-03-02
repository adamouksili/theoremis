// ─────────────────────────────────────────────────────────────
// Theoremis API  ·  GET /api/v1/health
// Health check + version info
// ─────────────────────────────────────────────────────────────

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();

    return res.status(200).json({
        ok: true,
        service: 'theoremis-api',
        version: '0.1.0',
        endpoints: {
            parse: 'POST /api/v1/parse',
            emit: 'POST /api/v1/emit',
            analyze: 'POST /api/v1/analyze',
            pipeline: 'POST /api/v1/pipeline',
        },
        targets: ['lean4', 'coq', 'isabelle'],
        bundles: ['ClassicalMath', 'Algebraic', 'NumberTheory', 'Analysis', 'Topology', 'LinearAlgebra', 'SetTheory', 'CategoryTheory'],
    });
}
