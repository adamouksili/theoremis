import { createHash } from 'crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join, posix } from 'path';

import type { MaterializedProject, VerificationFile, VerificationLimits, VerificationRequest } from './types';

const DEFAULT_LIMITS: VerificationLimits = {
    maxFiles: 64,
    maxFileBytes: 256 * 1024,
    maxTotalBytes: 1024 * 1024,
    timeoutMsMin: 1_000,
    timeoutMsMax: 120_000,
    memoryMbMin: 64,
    memoryMbMax: 1024,
};

function readIntEnv(name: string, fallback: number): number {
    const raw = Number(process.env[name]);
    if (!Number.isFinite(raw) || raw <= 0) return fallback;
    return Math.trunc(raw);
}

export function verificationLimits(): VerificationLimits {
    return {
        maxFiles: readIntEnv('THEOREMIS_V2_MAX_FILES', DEFAULT_LIMITS.maxFiles),
        maxFileBytes: readIntEnv('THEOREMIS_V2_MAX_FILE_BYTES', DEFAULT_LIMITS.maxFileBytes),
        maxTotalBytes: readIntEnv('THEOREMIS_V2_MAX_TOTAL_BYTES', DEFAULT_LIMITS.maxTotalBytes),
        timeoutMsMin: readIntEnv('THEOREMIS_V2_MIN_TIMEOUT_MS', DEFAULT_LIMITS.timeoutMsMin),
        timeoutMsMax: readIntEnv('THEOREMIS_V2_MAX_TIMEOUT_MS', DEFAULT_LIMITS.timeoutMsMax),
        memoryMbMin: readIntEnv('THEOREMIS_V2_MIN_MEMORY_MB', DEFAULT_LIMITS.memoryMbMin),
        memoryMbMax: readIntEnv('THEOREMIS_V2_MAX_MEMORY_MB', DEFAULT_LIMITS.memoryMbMax),
    };
}

function normalizeFilePath(value: string): string {
    const normalized = posix.normalize(String(value || '').replace(/\\/g, '/')).replace(/^\.\//, '');
    if (!normalized || normalized === '.' || normalized.startsWith('/')) {
        throw new Error(`Invalid file path: '${value}'`);
    }
    if (normalized.split('/').includes('..')) {
        throw new Error(`Path traversal is not allowed: '${value}'`);
    }
    if (!normalized.endsWith('.lean')) {
        throw new Error(`Only .lean files are allowed: '${value}'`);
    }
    return normalized;
}

function normalizedFiles(files: VerificationFile[]): VerificationFile[] {
    return files
        .map(file => ({
            path: normalizeFilePath(file.path),
            content: String(file.content ?? ''),
        }))
        .sort((a, b) => a.path.localeCompare(b.path));
}

function computeInputHash(entryFile: string, files: VerificationFile[]): string {
    const hash = createHash('sha256');
    hash.update(entryFile);
    for (const file of files) {
        hash.update('\n@@');
        hash.update(file.path);
        hash.update('\n');
        hash.update(file.content);
    }
    return hash.digest('hex');
}

export function normalizeVerificationRequest(request: VerificationRequest): VerificationRequest {
    const limits = verificationLimits();
    const files = normalizedFiles(request.project?.files ?? []);

    if (files.length === 0) {
        throw new Error('Verification project must include at least one .lean file.');
    }
    if (files.length > limits.maxFiles) {
        throw new Error(`Too many files: ${files.length} > ${limits.maxFiles}`);
    }

    let totalBytes = 0;
    for (const file of files) {
        const size = Buffer.byteLength(file.content, 'utf8');
        totalBytes += size;
        if (size > limits.maxFileBytes) {
            throw new Error(`File '${file.path}' exceeds max size (${limits.maxFileBytes} bytes).`);
        }
    }
    if (totalBytes > limits.maxTotalBytes) {
        throw new Error(`Project size exceeds max total (${limits.maxTotalBytes} bytes).`);
    }

    const entryFile = normalizeFilePath(request.entryFile);
    if (!files.some(file => file.path === entryFile)) {
        throw new Error(`entryFile '${entryFile}' is not present in project.files.`);
    }

    const timeoutCandidate = Number(request.timeoutMs);
    const timeoutMs = Number.isFinite(timeoutCandidate)
        ? Math.min(Math.max(Math.trunc(timeoutCandidate), limits.timeoutMsMin), limits.timeoutMsMax)
        : 20_000;

    const memoryCandidate = Number(request.memoryMb);
    const memoryMb = Number.isFinite(memoryCandidate)
        ? Math.min(Math.max(Math.trunc(memoryCandidate), limits.memoryMbMin), limits.memoryMbMax)
        : 256;

    return {
        project: { files },
        entryFile,
        timeoutMs,
        memoryMb,
        profile: request.profile === 'strict' ? 'strict' : 'default',
    };
}

export async function materializeVerificationProject(request: VerificationRequest): Promise<MaterializedProject> {
    const normalized = normalizeVerificationRequest(request);
    const files = normalized.project.files;

    const rootDir = await mkdtemp(join(tmpdir(), 'theoremis-v2-'));
    for (const file of files) {
        const abs = join(rootDir, file.path);
        await mkdir(dirname(abs), { recursive: true });
        await writeFile(abs, file.content, 'utf8');
    }

    const entryPath = join(rootDir, normalized.entryFile);
    return {
        rootDir,
        entryPath,
        files,
        inputHash: computeInputHash(normalized.entryFile, files),
    };
}

export async function cleanupMaterializedProject(project: MaterializedProject): Promise<void> {
    await rm(project.rootDir, { recursive: true, force: true });
}
