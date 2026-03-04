export type VerificationStatus = 'queued' | 'running' | 'verified' | 'rejected' | 'timeout' | 'error';

export type VerificationProfile = 'strict' | 'default';

export interface VerificationFile {
    path: string;
    content: string;
}

export interface VerificationProjectInput {
    files: VerificationFile[];
}

export interface VerificationRequest {
    project: VerificationProjectInput;
    entryFile: string;
    timeoutMs?: number;
    memoryMb?: number;
    profile?: VerificationProfile;
}

export interface VerificationLimits {
    maxFiles: number;
    maxFileBytes: number;
    maxTotalBytes: number;
    timeoutMsMin: number;
    timeoutMsMax: number;
    memoryMbMin: number;
    memoryMbMax: number;
}

export interface NormalizedDiagnostic {
    severity: 'error' | 'warning' | 'info';
    file: string;
    line: number;
    column: number;
    message: string;
}

export interface VerificationObligations {
    sorryCount: number;
    admitCount: number;
    unsolvedGoals: number;
}

export interface VerificationArtifacts {
    inputHash: string;
    outputHash: string;
    logHash: string;
    toolchainHash: string;
}

export interface VerificationTimings {
    queuedMs: number;
    runMs: number;
    totalMs: number;
}

export interface VerificationCheckerInfo {
    name: 'lean4';
    command: string;
    version: string | null;
    mathlib: string | null;
}

export interface VerificationResult {
    verified: boolean;
    status: Exclude<VerificationStatus, 'queued' | 'running'>;
    diagnostics: NormalizedDiagnostic[];
    obligations: VerificationObligations;
    checker: VerificationCheckerInfo;
    timings: VerificationTimings;
    artifacts: VerificationArtifacts;
}

export interface VerificationError {
    code: string;
    message: string;
}

export interface VerificationJob {
    id: string;
    status: VerificationStatus;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    request: VerificationRequest;
    result?: VerificationResult;
    error?: VerificationError;
}

export interface MaterializedProject {
    rootDir: string;
    entryPath: string;
    files: VerificationFile[];
    inputHash: string;
}

export interface LeanCheckExecution {
    ok: boolean;
    timedOut: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    elapsedMs: number;
    checkerVersion: string | null;
    mathlibVersion: string | null;
    command: string;
}
