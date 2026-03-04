import { applyCors, handlePreflight, requireMethod } from './_shared.js';

export default function handler(req, res) {
    applyCors(req, res, ['GET', 'OPTIONS']);
    if (handlePreflight(req, res)) return;
    if (!requireMethod(req, res, 'GET')) return;

    return res.status(200).json({
        ok: true,
        service: 'theoremis-api',
        version: '0.1.0',
        endpoints: {
            parse: 'POST /api/v1/parse',
            emit: 'POST /api/v1/emit',
            analyze: 'POST /api/v1/analyze',
            pipeline: 'POST /api/v1/pipeline',
            grade: 'POST /api/v1/grade',
            formalVerify: 'POST /api/v2/verify',
            formalJob: 'GET /api/v2/jobs/:id',
            formalTranslate: 'POST /api/v2/translate/latex',
        },
        targets: ['lean4', 'coq', 'isabelle'],
        bundles: ['ClassicalMath', 'Algebraic', 'NumberTheory', 'Analysis', 'Topology', 'LinearAlgebra', 'SetTheory', 'CategoryTheory'],
    });
}
