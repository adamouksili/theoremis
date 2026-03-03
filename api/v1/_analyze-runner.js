import { Worker } from 'worker_threads';

const DEFAULT_WORKER_TIMEOUT_MS = 6_000;
const MAX_WORKER_TIMEOUT_MS = 35_000;
const WORKER_BUFFER_MS = 500;

function resolveWorkerTimeoutMs(requestedTimeoutMs) {
    const base = typeof requestedTimeoutMs === 'number' && Number.isFinite(requestedTimeoutMs)
        ? Math.max(1, Math.trunc(requestedTimeoutMs))
        : DEFAULT_WORKER_TIMEOUT_MS;
    return Math.min(base + WORKER_BUFFER_MS, MAX_WORKER_TIMEOUT_MS);
}

export function runAnalyzeTaskInWorker(workerData, requestedTimeoutMs) {
    const timeoutMs = resolveWorkerTimeoutMs(requestedTimeoutMs);
    const workerUrl = new URL('./_analyze-worker.js', import.meta.url);

    return new Promise((resolve) => {
        const worker = new Worker(workerUrl, {
            type: 'module',
            workerData,
        });

        let settled = false;

        const complete = (payload) => {
            if (settled) return;
            settled = true;
            resolve(payload);
        };

        const timer = setTimeout(() => {
            void worker.terminate();
            complete({
                ok: false,
                timeout: true,
                error: `Worker timed out after ${timeoutMs}ms`,
            });
        }, timeoutMs);

        worker.once('message', (message) => {
            clearTimeout(timer);
            complete(message);
        });

        worker.once('error', (err) => {
            clearTimeout(timer);
            complete({
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            });
        });

        worker.once('exit', (code) => {
            clearTimeout(timer);
            if (!settled && code !== 0) {
                complete({
                    ok: false,
                    error: `Worker exited with code ${code}`,
                });
            }
        });
    });
}
