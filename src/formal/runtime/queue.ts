import { randomUUID } from 'crypto';
import { Worker } from 'worker_threads';

import type {
    VerificationError,
    VerificationJob,
    VerificationRequest,
    VerificationResult,
} from '../lean/types';
import { checkerRuntimeStatus } from '../lean/checker';

interface QueueState {
    jobs: Map<string, VerificationJob>;
    pending: string[];
    active: number;
    maxConcurrency: number;
}

/** Completed jobs older than this are evicted to prevent unbounded memory growth. */
const MAX_JOB_AGE_MS = 10 * 60 * 1000; // 10 minutes

const state: QueueState = {
    jobs: new Map(),
    pending: [],
    active: 0,
    maxConcurrency: Number(process.env.THEOREMIS_V2_QUEUE_CONCURRENCY || 1),
};

function isProd(): boolean {
    return process.env.NODE_ENV === 'production';
}

export function isFormalVerifyEnabled(): boolean {
    const flag = String(process.env.THEOREMIS_V2_VERIFY_ENABLED || 'true').toLowerCase();
    return flag !== '0' && flag !== 'false' && flag !== 'off';
}

export function runtimeReadyForFormalVerify(): { ok: boolean; reason?: string } {
    if (!isFormalVerifyEnabled()) {
        return { ok: false, reason: 'Formal verification is disabled by THEOREMIS_V2_VERIFY_ENABLED.' };
    }

    const allowMemoryQueue = String(process.env.THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE || '').toLowerCase() === 'true';
    if (isProd() && !allowMemoryQueue) {
        return {
            ok: false,
            reason: 'In production, THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE=true is required unless an external queue backend is configured.',
        };
    }

    if (isProd()) {
        const checker = checkerRuntimeStatus();
        if (!checker.ok) {
            return {
                ok: false,
                reason: checker.reason || 'Formal checker runtime is unavailable.',
            };
        }
    }

    return { ok: true };
}

function workerTimeoutMs(request: VerificationRequest): number {
    const timeout = Number(request.timeoutMs);
    const base = Number.isFinite(timeout) ? Math.max(1_000, Math.trunc(timeout)) : 20_000;
    return Math.min(base + 1_000, 130_000);
}

function errorResult(code: string, message: string): VerificationError {
    return { code, message };
}

function runIsolated(request: VerificationRequest): Promise<VerificationResult> {
    const timeoutMs = workerTimeoutMs(request);
    const workerUrl = new URL('./worker-entry.js', import.meta.url);

    return new Promise((resolve, reject) => {
        const worker = new Worker(workerUrl, {
            workerData: request,
            resourceLimits: {
                maxOldGenerationSizeMb: request.memoryMb ?? 256,
            },
        });

        let settled = false;
        const done = (fn: () => void) => {
            if (settled) return;
            settled = true;
            fn();
        };

        const timer = setTimeout(() => {
            void worker.terminate();
            done(() => reject(new Error(`Verification worker timed out after ${timeoutMs}ms`)));
        }, timeoutMs);

        worker.once('message', (message) => {
            clearTimeout(timer);
            done(() => {
                if (!message?.ok) {
                    reject(new Error(message?.error || 'Verification worker failed.'));
                    return;
                }
                resolve(message.result as VerificationResult);
            });
        });

        worker.once('error', (err) => {
            clearTimeout(timer);
            done(() => reject(err));
        });

        worker.once('exit', (code) => {
            clearTimeout(timer);
            done(() => {
                reject(new Error(
                    code !== 0
                        ? `Verification worker exited with code ${code}`
                        : 'Verification worker exited without producing a result'
                ));
            });
        });
    });
}

async function drainQueue(): Promise<void> {
    if (state.active >= state.maxConcurrency) return;
    const jobId = state.pending.shift();
    if (!jobId) return;

    const job = state.jobs.get(jobId);
    if (!job) {
        queueMicrotask(() => { void drainQueue(); });
        return;
    }

    state.active += 1;
    job.status = 'running';
    job.startedAt = new Date().toISOString();

    try {
        const result = await runIsolated(job.request);
        job.result = {
            ...result,
            timings: {
                ...result.timings,
                queuedMs: job.startedAt
                    ? Math.max(0, Date.parse(job.startedAt) - Date.parse(job.createdAt))
                    : 0,
                totalMs: job.startedAt
                    ? Math.max(0, Date.now() - Date.parse(job.createdAt))
                    : result.timings.totalMs,
            },
        };
        job.status = result.status;
        job.completedAt = new Date().toISOString();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isTimeout = /timed out/i.test(message);
        job.status = isTimeout ? 'timeout' : 'error';
        job.error = errorResult(isTimeout ? 'TIMEOUT' : 'WORKER_ERROR', message);
        job.completedAt = new Date().toISOString();
    } finally {
        state.active -= 1;
        evictStaleJobs();
        queueMicrotask(() => { void drainQueue(); });
    }
}

/** Remove completed/errored jobs older than MAX_JOB_AGE_MS to bound memory usage. */
function evictStaleJobs(): void {
    const cutoff = Date.now() - MAX_JOB_AGE_MS;
    for (const [id, job] of state.jobs) {
        if (job.status === 'queued' || job.status === 'running') continue;
        if (job.completedAt && Date.parse(job.completedAt) < cutoff) {
            state.jobs.delete(id);
        }
    }
}

export function enqueueVerificationJob(request: VerificationRequest): VerificationJob {
    const job: VerificationJob = {
        id: randomUUID(),
        status: 'queued',
        createdAt: new Date().toISOString(),
        request,
    };

    state.jobs.set(job.id, job);
    state.pending.push(job.id);
    queueMicrotask(() => { void drainQueue(); });

    return { ...job };
}

export function getVerificationJob(id: string): VerificationJob | null {
    const job = state.jobs.get(id);
    return job ? structuredClone(job) : null;
}

export function queueMetrics(): { depth: number; active: number; jobs: number } {
    return {
        depth: state.pending.length,
        active: state.active,
        jobs: state.jobs.size,
    };
}
