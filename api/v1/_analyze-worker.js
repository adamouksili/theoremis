import { parentPort, workerData } from 'worker_threads';
import { apiAnalyze, apiFullPipeline } from '../../src/api/pipeline.js';

async function runTask() {
    const { kind, latex, axiomBundle, options } = workerData || {};

    if (kind === 'pipeline') {
        return apiFullPipeline(latex, axiomBundle, options ?? {});
    }

    const numTests = typeof options?.numTests === 'number' ? options.numTests : 500;
    return apiAnalyze(latex, axiomBundle, numTests, options ?? {});
}

runTask()
    .then((result) => {
        parentPort?.postMessage({ ok: true, result });
    })
    .catch((err) => {
        parentPort?.postMessage({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        });
    });
