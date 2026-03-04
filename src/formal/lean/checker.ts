import { execFile, execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

import type { LeanCheckExecution, MaterializedProject, VerificationRequest } from './types';

const exec = promisify(execFile);

interface ExecError extends Error {
    code?: number | string;
    killed?: boolean;
    signal?: string;
    stdout?: string;
    stderr?: string;
}

function checkerProjectDir(): string {
    return process.env.THEOREMIS_LEAN_PROJECT || join(process.cwd(), '..', 'theoremis-lean-env');
}

let checkerStatusCache: { ok: boolean; reason?: string } | null = null;

export function checkerRuntimeStatus(): { ok: boolean; reason?: string } {
    if (checkerStatusCache) return checkerStatusCache;

    const cwd = checkerProjectDir();
    if (!existsSync(cwd)) {
        checkerStatusCache = {
            ok: false,
            reason: `Lean project directory does not exist: ${cwd}`,
        };
        return checkerStatusCache;
    }

    try {
        execFileSync('lake', ['--version'], {
            cwd,
            timeout: 8_000,
            stdio: 'ignore',
            env: {
                ...process.env,
                LC_ALL: 'C',
            },
        });
    } catch {
        checkerStatusCache = {
            ok: false,
            reason: "Lean checker dependency unavailable: 'lake' command not found or not executable.",
        };
        return checkerStatusCache;
    }

    checkerStatusCache = { ok: true };
    return checkerStatusCache;
}

let cachedVersion: string | null = null;

async function readCheckerVersion(cwd: string): Promise<string | null> {
    if (cachedVersion) return cachedVersion;
    try {
        const { stdout } = await exec('lake', ['env', 'lean', '--version'], {
            timeout: 8_000,
            cwd,
            env: {
                ...process.env,
                LC_ALL: 'C',
            },
            maxBuffer: 1024 * 1024,
        });
        cachedVersion = stdout.trim() || null;
        return cachedVersion;
    } catch {
        return null;
    }
}

export async function runLeanChecker(
    project: MaterializedProject,
    request: VerificationRequest,
): Promise<LeanCheckExecution> {
    const cwd = checkerProjectDir();
    const timeoutMs = request.timeoutMs ?? 20_000;
    const args = ['env', 'lean', '--root', project.rootDir, project.entryPath];

    const start = performance.now();
    try {
        const { stdout, stderr } = await exec('lake', args, {
            cwd,
            timeout: timeoutMs,
            env: {
                ...process.env,
                LC_ALL: 'C',
                LEAN_ABORT_ON_PANIC: '1',
            },
            maxBuffer: 16 * 1024 * 1024,
        });

        const elapsedMs = Math.round(performance.now() - start);
        return {
            ok: true,
            timedOut: false,
            exitCode: 0,
            stdout,
            stderr,
            elapsedMs,
            checkerVersion: await readCheckerVersion(cwd),
            mathlibVersion: process.env.THEOREMIS_MATHLIB_VERSION || null,
            command: `lake ${args.join(' ')}`,
        };
    } catch (err) {
        const elapsedMs = Math.round(performance.now() - start);
        const e = err as ExecError;
        return {
            ok: false,
            timedOut: Boolean(e.killed || e.signal === 'SIGTERM' || e.signal === 'SIGKILL'),
            exitCode: typeof e.code === 'number' ? e.code : 1,
            stdout: e.stdout || '',
            stderr: e.stderr || e.message || 'Unknown checker error',
            elapsedMs,
            checkerVersion: await readCheckerVersion(cwd),
            mathlibVersion: process.env.THEOREMIS_MATHLIB_VERSION || null,
            command: `lake ${args.join(' ')}`,
        };
    }
}
