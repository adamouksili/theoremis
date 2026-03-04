import { describe, expect, it } from 'vitest';
import { normalizeVerificationRequest } from '../../formal/lean/project';

describe('formal project normalization', () => {
    it('normalizes and clamps request values', () => {
        const request = normalizeVerificationRequest({
            project: {
                files: [
                    { path: './Main.lean', content: 'theorem t : True := by trivial' },
                ],
            },
            entryFile: './Main.lean',
            timeoutMs: 999999,
            memoryMb: 1,
            profile: 'strict',
        });

        expect(request.entryFile).toBe('Main.lean');
        expect(request.timeoutMs).toBeLessThanOrEqual(120000);
        expect(request.memoryMb).toBeGreaterThanOrEqual(64);
        expect(request.profile).toBe('strict');
    });

    it('rejects path traversal', () => {
        expect(() => normalizeVerificationRequest({
            project: { files: [{ path: '../secret.lean', content: 'theorem x : True := by trivial' }] },
            entryFile: '../secret.lean',
        })).toThrow(/Path traversal/i);
    });

    it('rejects missing entry file', () => {
        expect(() => normalizeVerificationRequest({
            project: { files: [{ path: 'Main.lean', content: 'theorem x : True := by trivial' }] },
            entryFile: 'Other.lean',
        })).toThrow(/entryFile/i);
    });
});
