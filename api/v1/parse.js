import { apiParse } from '../../src/api/pipeline.js';
import { authenticate, applyCors, applyRateLimit, handlePreflight, requireMethod, sendError, parseTypeCheckMode } from './_shared.js';

export default async function handler(req, res) {
    applyCors(req, res, ['POST', 'OPTIONS']);
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
        const { latex, axiomBundle, typeCheckMode: requestedTypeCheckMode } = req.body || {};

        if (!latex || typeof latex !== 'string') {
            return sendError(res, 400, 'Missing required field: latex (string)', {
                usage: {
                    method: 'POST',
                    body: {
                        latex: '\\begin{theorem}...\\end{theorem}',
                        axiomBundle: 'ClassicalMath',
                        typeCheckMode: 'permissive',
                    },
                },
            });
        }

        if (latex.length > 50000) {
            return sendError(res, 413, 'Input too large. Maximum 50,000 characters.');
        }

        const typeCheckMode = parseTypeCheckMode(requestedTypeCheckMode, 'permissive');
        const result = apiParse(latex, axiomBundle, typeCheckMode);

        return res.status(200).json({
            ok: true,
            tier: auth.tier,
            ...result,
        });
    } catch (err) {
        console.error('[parse] Internal error:', err);
        return sendError(res, 500, 'Internal server error.');
    }
}
