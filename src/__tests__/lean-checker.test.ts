import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkerRuntimeStatus, resetCheckerCache, runLeanChecker } from '../formal/lean/checker';
import type { MaterializedProject, VerificationRequest } from '../formal/lean/types';

vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return { ...actual, existsSync: vi.fn() };
});

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal<typeof import('child_process')>();
    return {
        ...actual,
        execFileSync: vi.fn(),
        execFile: vi.fn(),
    };
});

import { existsSync } from 'fs';
import { execFileSync, execFile } from 'child_process';

const mockExistsSync = vi.mocked(existsSync);
const mockExecFileSync = vi.mocked(execFileSync);
const mockExecFile = vi.mocked(execFile);

beforeEach(() => {
    resetCheckerCache();
    vi.clearAllMocks();
});

describe('checkerRuntimeStatus', () => {
    it('returns not-ok when project directory does not exist', () => {
        mockExistsSync.mockReturnValue(false);

        const status = checkerRuntimeStatus();

        expect(status.ok).toBe(false);
        expect(status.reason).toContain('does not exist');
    });

    it('returns not-ok when lake command is not found', () => {
        mockExistsSync.mockReturnValue(true);
        mockExecFileSync.mockImplementation(() => { throw new Error('ENOENT'); });

        const status = checkerRuntimeStatus();

        expect(status.ok).toBe(false);
        expect(status.reason).toContain('lake');
        expect(status.reason).toContain('not found');
    });

    it('returns ok when directory exists and lake works', () => {
        mockExistsSync.mockReturnValue(true);
        mockExecFileSync.mockReturnValue(Buffer.from('lake 4.0.0'));

        const status = checkerRuntimeStatus();

        expect(status.ok).toBe(true);
        expect(status.reason).toBeUndefined();
    });

    it('caches the result on subsequent calls', () => {
        mockExistsSync.mockReturnValue(true);
        mockExecFileSync.mockReturnValue(Buffer.from('lake 4.0.0'));

        const first = checkerRuntimeStatus();
        const second = checkerRuntimeStatus();

        expect(first).toBe(second);
        expect(mockExistsSync).toHaveBeenCalledTimes(1);
    });

    it('resetCheckerCache clears the cached result', () => {
        mockExistsSync.mockReturnValue(true);
        mockExecFileSync.mockReturnValue(Buffer.from('lake 4.0.0'));

        checkerRuntimeStatus();
        resetCheckerCache();

        mockExistsSync.mockReturnValue(false);
        const status = checkerRuntimeStatus();
        expect(status.ok).toBe(false);
    });
});

describe('runLeanChecker', () => {
    const project: MaterializedProject = {
        rootDir: '/tmp/test-project',
        entryPath: '/tmp/test-project/Main.lean',
        files: [{ path: 'Main.lean', content: 'theorem t : True := trivial' }],
        inputHash: 'abc123',
    };

    const request: VerificationRequest = {
        project: { files: project.files },
        entryFile: 'Main.lean',
        timeoutMs: 10_000,
    };

    it('returns success on clean execution', async () => {
        mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb?: any) => {
            const callback = cb ?? _opts;
            if (typeof callback === 'function') {
                callback(null, 'no errors\n', '');
            }
            return {} as any;
        });

        const result = await runLeanChecker(project, request);

        expect(result.ok).toBe(true);
        expect(result.timedOut).toBe(false);
        expect(result.exitCode).toBe(0);
        expect(result.command).toContain('lake');
        expect(result.command).toContain(project.entryPath);
    });

    it('returns failure with stderr on exec error', async () => {
        const error = Object.assign(new Error('process failed'), {
            code: 1,
            killed: false,
            signal: null,
            stdout: '',
            stderr: 'type mismatch\n  expected Nat\n  got Bool',
        });

        mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb?: any) => {
            const callback = cb ?? _opts;
            if (typeof callback === 'function') {
                callback(error, '', '');
            }
            return {} as any;
        });

        const result = await runLeanChecker(project, request);

        expect(result.ok).toBe(false);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('type mismatch');
    });

    it('detects timeout via killed signal', async () => {
        const error = Object.assign(new Error('timed out'), {
            killed: true,
            signal: 'SIGTERM',
            stdout: '',
            stderr: '',
        });

        mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb?: any) => {
            const callback = cb ?? _opts;
            if (typeof callback === 'function') {
                callback(error, '', '');
            }
            return {} as any;
        });

        const result = await runLeanChecker(project, request);

        expect(result.ok).toBe(false);
        expect(result.timedOut).toBe(true);
    });

    it('detects timeout via SIGKILL signal', async () => {
        const error = Object.assign(new Error('killed'), {
            killed: false,
            signal: 'SIGKILL',
            stdout: '',
            stderr: '',
        });

        mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb?: any) => {
            const callback = cb ?? _opts;
            if (typeof callback === 'function') {
                callback(error, '', '');
            }
            return {} as any;
        });

        const result = await runLeanChecker(project, request);

        expect(result.ok).toBe(false);
        expect(result.timedOut).toBe(true);
    });

    it('uses default timeout when not specified', async () => {
        mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb?: any) => {
            const callback = cb ?? _opts;
            if (typeof callback === 'function') {
                callback(null, '', '');
            }
            return {} as any;
        });

        const reqNoTimeout: VerificationRequest = {
            project: { files: project.files },
            entryFile: 'Main.lean',
        };

        const result = await runLeanChecker(project, reqNoTimeout);
        expect(result.ok).toBe(true);
    });

    it('falls back to error message when stderr is empty', async () => {
        const error = Object.assign(new Error('Something went wrong'), {
            code: 'ENOENT' as string | number,
            killed: false,
            stdout: '',
            stderr: '',
        });

        mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb?: any) => {
            const callback = cb ?? _opts;
            if (typeof callback === 'function') {
                callback(error, '', '');
            }
            return {} as any;
        });

        const result = await runLeanChecker(project, request);

        expect(result.ok).toBe(false);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Something went wrong');
    });
});
