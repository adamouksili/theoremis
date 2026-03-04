import { describe, expect, it } from 'vitest';
import { deriveVerificationStatus } from '../../formal/runtime/worker';
import type { LeanCheckExecution } from '../../formal/lean/types';

function baseExec(): LeanCheckExecution {
    return {
        ok: true,
        timedOut: false,
        exitCode: 0,
        stdout: '',
        stderr: '',
        elapsedMs: 1,
        checkerVersion: 'Lean 4.9.0',
        mathlibVersion: 'v0',
        command: 'lake env lean',
    };
}

describe('formal verification status derivation', () => {
    it('returns verified for clean checker pass', () => {
        const status = deriveVerificationStatus(baseExec(), 0, { sorryCount: 0, admitCount: 0, unsolvedGoals: 0 });
        expect(status).toBe('verified');
    });

    it('returns rejected when placeholders exist', () => {
        const status = deriveVerificationStatus(baseExec(), 0, { sorryCount: 1, admitCount: 0, unsolvedGoals: 0 });
        expect(status).toBe('rejected');
    });

    it('returns timeout when checker times out', () => {
        const status = deriveVerificationStatus({ ...baseExec(), timedOut: true }, 0, { sorryCount: 0, admitCount: 0, unsolvedGoals: 0 });
        expect(status).toBe('timeout');
    });
});
