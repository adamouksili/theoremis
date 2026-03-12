import { apiEmit } from '../../src/api/pipeline.js';
import { authenticate, applyCors, applyRateLimit, handlePreflight, requireMethod, sendError } from './_shared.js';

const VALID_TARGETS = ['lean4', 'coq', 'isabelle'];

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
        const { latex, axiomBundle, targets } = req.body || {};

        if (!latex || typeof latex !== 'string') {
            return sendError(res, 400, 'Missing required field: latex (string)', {
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

        if (latex.length > 50000) {
            return sendError(res, 413, 'Input too large. Maximum 50,000 characters.');
        }

        // Validate targets
        if (targets !== undefined) {
            if (!Array.isArray(targets)) {
                return sendError(res, 400, 'Field "targets" must be an array of strings.');
            }
            const invalid = targets.filter((t) => typeof t !== 'string' || !VALID_TARGETS.includes(t));
            if (invalid.length) {
                return sendError(res, 400, `Invalid targets: ${invalid.join(', ')}. Valid: ${VALID_TARGETS.join(', ')}`);
            }
        }

        const result = apiEmit(latex, axiomBundle, targets);

        return res.status(200).json({
            ok: true,
            authLevel: auth.authLevel,
            ...result,
        });
    } catch (err) {
        console.error('[emit] Internal error:', err);
        return sendError(res, 500, 'Internal server error.');
    }
}
