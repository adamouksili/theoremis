import { applyCors, handlePreflight, requireMethod } from './_shared.js';
import { queueMetrics, runtimeReadyForFormalVerify } from '../../src/formal/runtime/queue.js';

export default function handler(req, res) {
    applyCors(req, res, ['GET', 'OPTIONS']);
    if (handlePreflight(req, res)) return;
    if (!requireMethod(req, res, 'GET')) return;

    const runtime = runtimeReadyForFormalVerify();
    return res.status(runtime.ok ? 200 : 503).json({
        ok: runtime.ok,
        service: 'theoremis-formal-api',
        version: '2.0.0',
        endpoints: {
            verify: 'POST /api/v2/verify',
            jobs: 'GET /api/v2/jobs/:id',
            translateLatex: 'POST /api/v2/translate/latex',
            health: 'GET /api/v2/health',
        },
        runtime,
        queue: queueMetrics(),
    });
}
