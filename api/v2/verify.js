import {
    applyCors,
    applyRateLimit,
    authenticate,
    handlePreflight,
    requireMethod,
    sendError,
    setNoCache,
} from './_shared.js';
import { enqueueVerificationJob, queueMetrics, runtimeReadyForFormalVerify } from '../../src/formal/runtime/queue.js';
import { normalizeVerificationRequest } from '../../src/formal/lean/project.js';

export default async function handler(req, res) {
    applyCors(req, res, ['POST', 'OPTIONS']);
    setNoCache(res);
    if (handlePreflight(req, res)) return;
    if (!requireMethod(req, res, 'POST')) return;

    const auth = authenticate(req);
    if (!auth.valid) {
        return sendError(res, auth.status || 401, auth.error || 'Invalid API key.');
    }

    const rate = await applyRateLimit(req, res, auth);
    if (!rate.ok) {
        return sendError(res, rate.status || 429, rate.error || 'Rate limit exceeded.');
    }

    const runtime = runtimeReadyForFormalVerify();
    if (!runtime.ok) {
        return sendError(res, 503, runtime.reason || 'Formal verification runtime unavailable.');
    }

    try {
        const body = req.body || {};
        const request = normalizeVerificationRequest(body);
        const job = enqueueVerificationJob(request);

        return res.status(202).json({
            ok: true,
            mode: 'formal-verification',
            verified: false,
            job: {
                id: job.id,
                status: job.status,
                createdAt: job.createdAt,
            },
            queue: queueMetrics(),
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return sendError(res, 400, message);
    }
}
