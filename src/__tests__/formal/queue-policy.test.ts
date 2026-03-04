import { afterEach, describe, expect, it } from 'vitest';
import { runtimeReadyForFormalVerify } from '../../formal/runtime/queue';

const env = {
    NODE_ENV: process.env.NODE_ENV,
    THEOREMIS_V2_VERIFY_ENABLED: process.env.THEOREMIS_V2_VERIFY_ENABLED,
    THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE: process.env.THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE,
    THEOREMIS_LEAN_PROJECT: process.env.THEOREMIS_LEAN_PROJECT,
};

afterEach(() => {
    process.env.NODE_ENV = env.NODE_ENV;
    process.env.THEOREMIS_V2_VERIFY_ENABLED = env.THEOREMIS_V2_VERIFY_ENABLED;
    process.env.THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE = env.THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE;
    process.env.THEOREMIS_LEAN_PROJECT = env.THEOREMIS_LEAN_PROJECT;
});

describe('formal queue runtime policy', () => {
    it('fails closed in production without explicit queue allowance', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE;
        process.env.THEOREMIS_V2_VERIFY_ENABLED = 'true';

        const ready = runtimeReadyForFormalVerify();
        expect(ready.ok).toBe(false);
    });

    it('allows runtime in dev by default', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE;
        process.env.THEOREMIS_V2_VERIFY_ENABLED = 'true';

        const ready = runtimeReadyForFormalVerify();
        expect(ready.ok).toBe(true);
    });

    it('fails closed in production when Lean checker runtime is unavailable', () => {
        process.env.NODE_ENV = 'production';
        process.env.THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE = 'true';
        process.env.THEOREMIS_V2_VERIFY_ENABLED = 'true';
        process.env.THEOREMIS_LEAN_PROJECT = '/tmp/theoremis-does-not-exist';

        const ready = runtimeReadyForFormalVerify();
        expect(ready.ok).toBe(false);
        expect(ready.reason).toMatch(/Lean project directory does not exist/i);
    });
});
