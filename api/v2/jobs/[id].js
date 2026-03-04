import {
    applyCors,
    applyRateLimit,
    authenticate,
    handlePreflight,
    requireMethod,
    sendError,
    setNoCache,
} from '../_shared.js';
import { getVerificationJob, queueMetrics, runtimeReadyForFormalVerify } from '../../../src/formal/runtime/queue.js';

function resolveJobId(req) {
    if (req.query?.id) return String(req.query.id);
    const url = String(req.url || '');
    const parts = url.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
}

export default async function handler(req, res) {
    applyCors(req, res, ['GET', 'OPTIONS']);
    setNoCache(res);
    if (handlePreflight(req, res)) return;
    if (!requireMethod(req, res, 'GET')) return;

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

    const id = resolveJobId(req);
    if (!id) {
        return sendError(res, 400, 'Missing job id.');
    }

    const job = getVerificationJob(id);
    if (!job) {
        return sendError(res, 404, `Verification job '${id}' not found.`);
    }

    return res.status(200).json({
        ok: true,
        mode: 'formal-verification',
        job,
        queue: queueMetrics(),
    });
}
