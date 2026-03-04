import { parentPort, workerData } from 'worker_threads';
import { runVerificationJob } from './worker.js';

runVerificationJob(workerData)
    .then((result) => {
        parentPort?.postMessage({ ok: true, result });
    })
    .catch((err) => {
        parentPort?.postMessage({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        });
    });
