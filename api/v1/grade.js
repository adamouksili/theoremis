import { gradeSubmission } from '../../src/api/grader.js';
import { authenticate, applyCors, applyRateLimit, handlePreflight, requireMethod, sendError, parseTypeCheckMode } from './_shared.js';

export default async function handler(req, res) {
    applyCors(req, res, ['POST', 'OPTIONS']);
    if (handlePreflight(req, res)) return;
    if (!requireMethod(req, res, 'POST')) return;

    const auth = authenticate(req, { anonymous: 20, authenticated: 5000 });
    if (!auth.valid) {
        return sendError(res, auth.status || 401, auth.error || 'Invalid API key.');
    }

    const rate = await applyRateLimit(req, res, auth);
    if (!rate.ok) {
        return sendError(res, rate.status || 429, rate.error || 'Rate limit exceeded.');
    }

    try {
        const { latex, rubric, studentId, typeCheckMode: bodyTypeCheckMode } = req.body || {};

        if (!latex || typeof latex !== 'string') {
            return sendError(res, 400, 'Missing required field: latex (string)', {
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
                        typeCheckMode: 'strict',
                        studentId: 'student_123',
                    },
                },
            });
        }

        if (latex.length > 100000) {
            return sendError(res, 413, 'Input too large. Maximum 100,000 characters.');
        }

        const defaultTypeCheckMode = process.env.NODE_ENV === 'production' ? 'strict' : 'permissive';
        const typeCheckMode = parseTypeCheckMode(
            bodyTypeCheckMode ?? rubric?.typeCheckMode,
            defaultTypeCheckMode,
        );
        const rubricWithMode = { ...(rubric ?? {}), typeCheckMode };
        const result = gradeSubmission(latex, rubricWithMode, studentId);

        return res.status(200).json({
            ok: true,
            authLevel: auth.authLevel,
            ...result,
        });
    } catch (err) {
        console.error('[grade] Internal error:', err);
        return sendError(res, 500, 'Internal server error.');
    }
}
