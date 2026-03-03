declare module '*api/v1/_shared.js' {
    export function authenticate(req: { headers?: Record<string, string> }, rates?: { free: number; pro: number }): {
        valid: boolean;
        tier: 'free' | 'pro';
        keyId?: string | null;
        rateLimit: number;
        error?: string;
        status?: number;
    };

    export function applyRateLimit(
        req: { headers?: Record<string, string> },
        res: { setHeader: (key: string, value: string) => void },
        auth: {
            valid: boolean;
            tier: 'free' | 'pro';
            keyId?: string | null;
            rateLimit: number;
        },
    ): Promise<{ ok: boolean; status?: number; error?: string }>;

    export function applyCors(
        req: { headers?: Record<string, string> },
        res: { setHeader: (key: string, value: string) => void },
        methods?: string[],
    ): void;

    export function handlePreflight(
        req: { method?: string },
        res: { status: (code: number) => { end: () => unknown } },
    ): boolean;

    export function requireMethod(
        req: { method?: string },
        res: { status: (code: number) => { json: (payload: unknown) => unknown } },
        method: string,
    ): boolean;

    export function sendError(
        res: { status: (code: number) => { json: (payload: unknown) => unknown } },
        status: number,
        error: string,
        details?: unknown,
    ): unknown;

    export function parseTypeCheckMode(value: unknown, defaultMode?: 'permissive' | 'strict'): 'permissive' | 'strict';

    export function parseAnalyzeOptions(body: unknown, defaultTypeCheckMode?: 'permissive' | 'strict'): {
        numTests?: number;
        seed?: number;
        timeoutMs?: number;
        maxCounterexamples?: number;
        maxWorkItems?: number;
        typeCheckMode: 'permissive' | 'strict';
    };
}
