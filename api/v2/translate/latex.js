import { apiEmit } from '../../../src/api/pipeline.js';
import {
    applyCors,
    applyRateLimit,
    authenticate,
    handlePreflight,
    requireMethod,
    sendError,
    setNoCache,
} from '../_shared.js';

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

    try {
        const body = req.body || {};
        const latex = String(body.latex || '');
        const axiomBundle = typeof body.axiomBundle === 'string' ? body.axiomBundle : undefined;

        if (!latex) {
            return sendError(res, 400, 'Missing required field: latex (string).');
        }
        if (latex.length > 100_000) {
            return sendError(res, 413, 'Input too large. Maximum 100,000 characters.');
        }

        const emitted = apiEmit(latex, axiomBundle, ['lean4']);
        return res.status(200).json({
            ok: true,
            mode: 'draft-translation',
            note: 'Draft translation is advisory only and is not a formal verification result.',
            leanDraft: emitted.lean4,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return sendError(res, 500, message);
    }
}
