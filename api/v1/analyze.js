import { authenticate, applyCors, applyRateLimit, handlePreflight, requireMethod, sendError, parseAnalyzeOptions } from './_shared.js';
import { runAnalyzeTaskInWorker } from './_analyze-runner.js';

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
        const body = req.body || {};
        const { latex, axiomBundle } = body;

        if (!latex || typeof latex !== 'string') {
            return sendError(res, 400, 'Missing required field: latex (string)', {
                usage: {
                    method: 'POST',
                    body: {
                        latex: '\\begin{theorem}...\\end{theorem}',
                        axiomBundle: 'ClassicalMath',
                        numTests: 1000,
                        seed: 1234,
                        timeoutMs: 2000,
                        maxCounterexamples: 5,
                        maxWorkItems: 100,
                        typeCheckMode: 'strict',
                    },
                },
            });
        }

        if (latex.length > 50000) {
            return sendError(res, 413, 'Input too large. Maximum 50,000 characters.');
        }

        const defaultTypeCheckMode = process.env.NODE_ENV === 'production' ? 'strict' : 'permissive';
        const { numTests, seed, timeoutMs, maxCounterexamples, maxWorkItems, typeCheckMode } = parseAnalyzeOptions(
            body,
            defaultTypeCheckMode,
        );
        const workerResponse = await runAnalyzeTaskInWorker(
            {
                kind: 'analyze',
                latex,
                axiomBundle,
                options: {
                    numTests,
                    seed,
                    timeoutMs,
                    maxCounterexamples,
                    maxWorkItems,
                    typeCheckMode,
                },
            },
            timeoutMs,
        );

        if (!workerResponse?.ok) {
            if (workerResponse?.timeout) {
                return res.status(200).json({
                    ok: true,
                    tier: auth.tier,
                    theorems: [],
                    overall: {
                        totalDeclarations: 0,
                        theoremCount: 0,
                        definitionCount: 0,
                        lemmaCount: 0,
                        analyzedTheoremCount: 0,
                        axiomBudget: [],
                        typeCheckValid: false,
                        diagnosticCount: 1,
                    },
                    truncated: true,
                    truncationReason: workerResponse.error || 'worker timeout',
                });
            }
            return sendError(res, 500, workerResponse?.error || 'Analyze worker failed.');
        }

        const result = workerResponse.result;

        return res.status(200).json({
            ok: true,
            tier: auth.tier,
            ...result,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return sendError(res, 500, message);
    }
}
