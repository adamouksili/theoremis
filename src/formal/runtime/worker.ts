import { createHash } from 'crypto';

import { cleanupMaterializedProject, materializeVerificationProject, normalizeVerificationRequest } from '../lean/project';
import { runLeanChecker } from '../lean/checker';
import { normalizeLeanDiagnostics } from '../lean/diagnostics';
import { collectObligations } from '../lean/obligations';
import type {
    LeanCheckExecution,
    VerificationRequest,
    VerificationResult,
} from '../lean/types';

function sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

export function deriveVerificationStatus(
    execution: LeanCheckExecution,
    errorCount: number,
    obligations: { sorryCount: number; admitCount: number; unsolvedGoals: number },
): VerificationResult['status'] {
    if (execution.timedOut) return 'timeout';
    if (execution.exitCode !== 0) return 'rejected';
    if (errorCount > 0) return 'rejected';
    if (obligations.sorryCount > 0 || obligations.admitCount > 0 || obligations.unsolvedGoals > 0) {
        return 'rejected';
    }
    return 'verified';
}

export async function runVerificationJob(request: VerificationRequest): Promise<VerificationResult> {
    const normalized = normalizeVerificationRequest(request);
    const queuedAt = performance.now();
    const project = await materializeVerificationProject(normalized);

    try {
        const execution = await runLeanChecker(project, normalized);
        const diagnostics = normalizeLeanDiagnostics(`${execution.stderr}\n${execution.stdout}`);
        const obligations = collectObligations(project.files, diagnostics);
        const errorCount = diagnostics.filter(d => d.severity === 'error').length;
        const status = deriveVerificationStatus(execution, errorCount, obligations);
        const verified = status === 'verified';

        const outputMaterial = JSON.stringify({ status, diagnostics, obligations, exitCode: execution.exitCode });
        const toolchainMaterial = JSON.stringify({
            checkerVersion: execution.checkerVersion,
            mathlibVersion: execution.mathlibVersion,
            command: execution.command,
        });

        return {
            verified,
            status,
            diagnostics,
            obligations,
            checker: {
                name: 'lean4',
                command: execution.command,
                version: execution.checkerVersion,
                mathlib: execution.mathlibVersion,
            },
            timings: {
                queuedMs: 0,
                runMs: execution.elapsedMs,
                totalMs: Math.max(execution.elapsedMs, Math.round(performance.now() - queuedAt)),
            },
            artifacts: {
                inputHash: project.inputHash,
                outputHash: sha256(outputMaterial),
                logHash: sha256(`${execution.stdout}\n---\n${execution.stderr}`),
                toolchainHash: sha256(toolchainMaterial),
            },
        };
    } finally {
        await cleanupMaterializedProject(project);
    }
}
