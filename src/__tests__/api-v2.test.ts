import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import verifyHandler from '../../api/v2/verify.js';
import translateLatexHandler from '../../api/v2/translate/latex.js';
import healthHandler from '../../api/v2/health.js';

function makeReq(method = 'POST', body: unknown = {}, headers: Record<string, string> = {}) {
    return { method, body, headers, query: {}, url: '/api/v2/verify' } as {
        method: string;
        body: unknown;
        headers: Record<string, string>;
        query: Record<string, string>;
        url: string;
    };
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
    THEOREMIS_V2_VERIFY_ENABLED: process.env.THEOREMIS_V2_VERIFY_ENABLED,
    THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE: process.env.THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE,
};

beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.THEOREMIS_V2_VERIFY_ENABLED = 'true';
    process.env.THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE = 'true';
});

afterEach(() => {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.THEOREMIS_V2_VERIFY_ENABLED = originalEnv.THEOREMIS_V2_VERIFY_ENABLED;
    process.env.THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE = originalEnv.THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE;
});

describe('api v2 formal endpoints', () => {
    it('returns 400 for invalid verify payload', async () => {
        const req = makeReq('POST', { foo: 'bar' });
        const res = makeRes();
        await verifyHandler(req as never, res as never);

        expect(res.statusCode).toBe(400);
        expect((res.payload as { ok: boolean }).ok).toBe(false);
    });

    it('returns draft translation payload without verified field', async () => {
        const req = makeReq('POST', {
            latex: '\\begin{theorem}For all $x \\in \\mathbb{R}$, $x^2 \\geq 0$.\\end{theorem}',
        });
        const res = makeRes();
        await translateLatexHandler(req as never, res as never);

        expect(res.statusCode).toBe(200);
        const payload = res.payload as Record<string, unknown>;
        expect(payload.mode).toBe('draft-translation');
        expect(Object.prototype.hasOwnProperty.call(payload, 'verified')).toBe(false);
    });

    it('reports runtime state in v2 health', () => {
        const req = makeReq('GET', {});
        req.url = '/api/v2/health';
        const res = makeRes();
        healthHandler(req as never, res as never);

        expect([200, 503]).toContain(res.statusCode);
        expect((res.payload as Record<string, unknown>).service).toBe('theoremis-formal-api');
    });
});
