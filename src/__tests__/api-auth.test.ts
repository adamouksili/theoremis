import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
    authenticate,
    applyCors,
    applyRateLimit,
    handlePreflight,
    parseAnalyzeOptions,
    parseTypeCheckMode,
} from '../../api/v1/_shared.js';

function makeReq(method = 'POST', headers: Record<string, string> = {}) {
    return { method, headers } as { method: string; headers: Record<string, string> };
}

function makeRes() {
    const headers: Record<string, string> = {};
    const res = {
        statusCode: 200,
        payload: null as unknown,
        setHeader(key: string, value: string) {
            headers[key] = value;
        },
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(payload: unknown) {
            this.payload = payload;
            return this;
        },
        end() {
            return this;
        },
        _headers: headers,
    };
    return res;
}

const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    THEOREMIS_API_KEYS: process.env.THEOREMIS_API_KEYS,
    THEOREMIS_ALLOWED_ORIGINS: process.env.THEOREMIS_ALLOWED_ORIGINS,
    THEOREMIS_REDIS_URL: process.env.THEOREMIS_REDIS_URL,
    THEOREMIS_REDIS_TOKEN: process.env.THEOREMIS_REDIS_TOKEN,
};

beforeEach(() => {
    delete process.env.THEOREMIS_API_KEYS;
    delete process.env.THEOREMIS_ALLOWED_ORIGINS;
    delete process.env.THEOREMIS_REDIS_URL;
    delete process.env.THEOREMIS_REDIS_TOKEN;
    process.env.NODE_ENV = 'development';
});

afterEach(() => {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.THEOREMIS_API_KEYS = originalEnv.THEOREMIS_API_KEYS;
    process.env.THEOREMIS_ALLOWED_ORIGINS = originalEnv.THEOREMIS_ALLOWED_ORIGINS;
    process.env.THEOREMIS_REDIS_URL = originalEnv.THEOREMIS_REDIS_URL;
    process.env.THEOREMIS_REDIS_TOKEN = originalEnv.THEOREMIS_REDIS_TOKEN;
});

describe('api shared helpers', () => {
    it('authenticates legacy dev tokens when key list is not configured', () => {
        const req = makeReq('POST', { authorization: 'Bearer thm_dev_token' });
        const auth = authenticate(req);
        expect(auth.valid).toBe(true);
        expect(auth.authLevel).toBe('authenticated');
    });

    it('requires configured keys in production', () => {
        process.env.NODE_ENV = 'production';
        process.env.THEOREMIS_API_KEYS = 'thm_live_1,thm_live_2';

        const validReq = makeReq('POST', { authorization: 'Bearer thm_live_1' });
        const invalidReq = makeReq('POST', { authorization: 'Bearer thm_fake' });

        expect(authenticate(validReq).valid).toBe(true);
        expect(authenticate(validReq).authLevel).toBe('authenticated');
        expect(authenticate(invalidReq).valid).toBe(false);
    });

    it('fails closed in production when key config is missing', () => {
        process.env.NODE_ENV = 'production';
        const auth = authenticate(makeReq('POST'));
        expect(auth.valid).toBe(false);
        expect(auth.status).toBe(503);
    });

    it('applies origin allowlist for CORS', () => {
        process.env.NODE_ENV = 'production';
        process.env.THEOREMIS_ALLOWED_ORIGINS = 'https://a.example,https://b.example';

        const req = makeReq('POST', { origin: 'https://b.example' });
        const res = makeRes();
        applyCors(req, res, ['POST', 'OPTIONS']);

        expect(res._headers['Access-Control-Allow-Origin']).toBe('https://b.example');
        expect(res._headers['Access-Control-Allow-Methods']).toContain('POST');
    });

    it('handles OPTIONS preflight', () => {
        const req = makeReq('OPTIONS');
        const res = makeRes();
        const handled = handlePreflight(req, res);
        expect(handled).toBe(true);
        expect(res.statusCode).toBe(204);
    });

    it('parses analyze options with bounds', () => {
        const parsed = parseAnalyzeOptions({
            numTests: 50000,
            seed: 12.8,
            timeoutMs: 0,
            maxCounterexamples: 100,
            maxWorkItems: 500,
            typeCheckMode: 'strict',
        });
        expect(parsed.numTests).toBe(10000);
        expect(parsed.seed).toBe(12);
        expect(parsed.timeoutMs).toBe(1);
        expect(parsed.maxCounterexamples).toBe(50);
        expect(parsed.maxWorkItems).toBe(200);
        expect(parsed.typeCheckMode).toBe('strict');
    });

    it('defaults unknown typecheck mode to provided default', () => {
        expect(parseTypeCheckMode('unexpected', 'strict')).toBe('strict');
    });

    it('uses in-memory rate limiting in development', async () => {
        const req = makeReq('POST');
        const res = makeRes();
        const auth = authenticate(req, { anonymous: 1, authenticated: 1 });

        const first = await applyRateLimit(req, res, auth);
        const second = await applyRateLimit(req, res, auth);

        expect(first.ok).toBe(true);
        expect(second.ok).toBe(false);
        expect(second.status).toBe(429);
        expect(res._headers['X-RateLimit-Limit']).toBe('1');
    });

    it('fails closed for production rate limit config when redis is missing', async () => {
        process.env.NODE_ENV = 'production';
        process.env.THEOREMIS_API_KEYS = 'thm_live_1';

        const req = makeReq('POST', { authorization: 'Bearer thm_live_1' });
        const res = makeRes();
        const auth = authenticate(req);
        const rate = await applyRateLimit(req, res, auth);

        expect(rate.ok).toBe(false);
        expect(rate.status).toBe(503);
    });
});
