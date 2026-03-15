import { createHash } from 'crypto';

const DEFAULT_PROD_ORIGINS = ['https://theoremis.com', 'https://www.theoremis.com'];
const DEFAULT_RATES = { anonymous: 100, authenticated: 10000 };
const DEFAULT_RATE_WINDOW_SEC = 60;

const MAX_NUM_TESTS = 10_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_WORK_ITEMS = 200;
const MAX_COUNTEREXAMPLES = 50;

const localRateBuckets = new Map();

function parseCsv(raw) {
    if (!raw) return [];
    return String(raw)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}

function parsePositiveInt(raw, fallback) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.trunc(n);
}

export function isDev() {
    return process.env.NODE_ENV !== 'production';
}

function getAllowedOrigins() {
    const configured = parseCsv(process.env.THEOREMIS_ALLOWED_ORIGINS);
    if (configured.length > 0) return configured;
    return isDev() ? ['*'] : DEFAULT_PROD_ORIGINS;
}

function parseConfiguredKeys() {
    const rawKeys = parseCsv(process.env.THEOREMIS_API_KEYS);
    const keys = new Map();

    for (const rawKey of rawKeys) {
        if (!rawKey) continue;
        keys.set(rawKey, 'authenticated');
    }

    return keys;
}

function extractBearerKey(req) {
    const auth = req.headers?.authorization || req.headers?.Authorization || '';
    return String(auth).replace(/^Bearer\s+/i, '').trim();
}

function resolveRates(overrides) {
    const anonymous = parsePositiveInt(process.env.THEOREMIS_RATE_LIMIT_ANONYMOUS, overrides?.anonymous ?? DEFAULT_RATES.anonymous);
    const authenticated = parsePositiveInt(process.env.THEOREMIS_RATE_LIMIT_AUTHENTICATED, overrides?.authenticated ?? DEFAULT_RATES.authenticated);
    return { anonymous, authenticated };
}

function getRateWindowSec() {
    return parsePositiveInt(process.env.THEOREMIS_RATE_LIMIT_WINDOW_SEC, DEFAULT_RATE_WINDOW_SEC);
}

function getClientIp(req) {
    const xff = req.headers?.['x-forwarded-for'] || req.headers?.['X-Forwarded-For'];
    if (typeof xff === 'string' && xff.length > 0) {
        return xff.split(',')[0].trim() || 'unknown';
    }
    const realIp = req.headers?.['x-real-ip'] || req.headers?.['X-Real-Ip'];
    if (typeof realIp === 'string' && realIp.length > 0) {
        return realIp;
    }
    return 'local';
}

function getRedisConfig() {
    const url = String(process.env.THEOREMIS_REDIS_URL || '').trim().replace(/\/$/, '');
    const token = String(process.env.THEOREMIS_REDIS_TOKEN || '').trim();
    return {
        url,
        token,
        configured: url.length > 0 && token.length > 0,
    };
}

function setRateLimitHeaders(res, limit, remaining, resetEpochSec) {
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
    res.setHeader('X-RateLimit-Reset', String(resetEpochSec));
}

function consumeLocalSlidingWindow(bucket, limit, windowSec) {
    const now = Date.now();
    const windowMs = windowSec * 1000;
    const oldestAllowed = now - windowMs;

    const samples = localRateBuckets.get(bucket) ?? [];
    const recent = samples.filter(ts => ts > oldestAllowed);
    recent.push(now);
    localRateBuckets.set(bucket, recent);

    const count = recent.length;
    const allowed = count <= limit;
    const oldest = recent.length > 0 ? recent[0] : now;
    const resetEpochSec = Math.ceil((oldest + windowMs) / 1000);

    return {
        allowed,
        remaining: Math.max(0, limit - count),
        resetEpochSec,
    };
}

async function consumeRedisSlidingWindow(bucket, limit, windowSec) {
    const { url, token } = getRedisConfig();
    const now = Date.now();
    const windowMs = windowSec * 1000;
    const oldestAllowed = now - windowMs;
    const member = `${now}-${Math.random().toString(36).slice(2)}`;

    const payload = [
        ['ZREMRANGEBYSCORE', bucket, '-inf', String(oldestAllowed)],
        ['ZADD', bucket, String(now), member],
        ['EXPIRE', bucket, String(windowSec + 5)],
        ['ZCARD', bucket],
        ['ZRANGE', bucket, '0', '0', 'WITHSCORES'],
    ];

    const response = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Redis rate-limit request failed (${response.status})`);
    }

    const data = await response.json();
    const count = Number(data?.[3]?.result ?? 0);
    const first = data?.[4]?.result;

    let firstScore = now;
    if (Array.isArray(first) && first.length >= 2) {
        const parsed = Number(first[1]);
        if (Number.isFinite(parsed)) firstScore = parsed;
    }

    return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetEpochSec: Math.ceil((firstScore + windowMs) / 1000),
    };
}

export function authenticate(req, rates = DEFAULT_RATES) {
    const key = extractBearerKey(req);
    const configuredKeys = parseConfiguredKeys();
    const resolvedRates = resolveRates(rates);

    if (!isDev()) {
        if (configuredKeys.size === 0) {
            return {
                valid: false,
                authLevel: 'anonymous',
                keyId: null,
                rateLimit: resolvedRates.anonymous,
                error: 'Production API key validation is not configured (THEOREMIS_API_KEYS required).',
                status: 503,
            };
        }

        if (!key) {
            return {
                valid: false,
                authLevel: 'anonymous',
                keyId: null,
                rateLimit: resolvedRates.anonymous,
                error: 'Missing API key.',
                status: 401,
            };
        }

        const authLevel = configuredKeys.get(key);
        if (!authLevel) {
            return {
                valid: false,
                authLevel: 'anonymous',
                keyId: key,
                rateLimit: resolvedRates.anonymous,
                error: 'Invalid API key.',
                status: 401,
            };
        }

        return {
            valid: true,
            authLevel,
            keyId: key,
            rateLimit: authLevel === 'authenticated' ? resolvedRates.authenticated : resolvedRates.anonymous,
            rates: resolvedRates,
        };
    }

    if (configuredKeys.size > 0) {
        if (!key) {
            return {
                valid: true,
                authLevel: 'anonymous',
                keyId: null,
                rateLimit: resolvedRates.anonymous,
                rates: resolvedRates,
            };
        }

        const authLevel = configuredKeys.get(key);
        if (!authLevel) {
            return {
                valid: false,
                authLevel: 'anonymous',
                keyId: key,
                rateLimit: resolvedRates.anonymous,
                error: 'Invalid API key.',
                status: 401,
            };
        }

        return {
            valid: true,
            authLevel,
            keyId: key,
            rateLimit: authLevel === 'authenticated' ? resolvedRates.authenticated : resolvedRates.anonymous,
            rates: resolvedRates,
        };
    }

    if (!key) {
        return {
            valid: true,
            authLevel: 'anonymous',
            keyId: null,
            rateLimit: resolvedRates.anonymous,
            rates: resolvedRates,
        };
    }

    if (key.startsWith('thm_')) {
        return {
            valid: true,
            authLevel: 'authenticated',
            keyId: key,
            rateLimit: resolvedRates.authenticated,
            rates: resolvedRates,
        };
    }

    return {
        valid: true,
        authLevel: 'anonymous',
        keyId: null,
        rateLimit: resolvedRates.anonymous,
        rates: resolvedRates,
    };
}

export async function applyRateLimit(req, res, auth) {
    if (!auth?.valid) {
        return { ok: false, status: auth?.status ?? 401, error: auth?.error || 'Invalid API key.' };
    }

    const windowSec = getRateWindowSec();
    const limit = auth.rateLimit;
    const redis = getRedisConfig();

    if (!isDev() && !redis.configured) {
        return {
            ok: false,
            status: 503,
            error: 'Production rate limiting is not configured (THEOREMIS_REDIS_URL/THEOREMIS_REDIS_TOKEN required).',
        };
    }

    const rawIdentity = auth.keyId ? auth.keyId : getClientIp(req);
    const hashedIdentity = createHash('sha256').update(rawIdentity).digest('hex').slice(0, 16);
    const bucket = `theoremis:rl:v1:${auth.authLevel}:${hashedIdentity}`;

    try {
        const result = redis.configured
            ? await consumeRedisSlidingWindow(bucket, limit, windowSec)
            : consumeLocalSlidingWindow(bucket, limit, windowSec);

        setRateLimitHeaders(res, limit, result.remaining, result.resetEpochSec);

        if (!result.allowed) {
            return {
                ok: false,
                status: 429,
                error: 'Rate limit exceeded.',
            };
        }

        return { ok: true };
    } catch (err) {
        if (!isDev()) {
            return {
                ok: false,
                status: 503,
                error: err instanceof Error ? err.message : 'Rate limiter unavailable.',
            };
        }

        // Explicit development fallback if Redis is down.
        const local = consumeLocalSlidingWindow(bucket, limit, windowSec);
        setRateLimitHeaders(res, limit, local.remaining, local.resetEpochSec);
        if (!local.allowed) {
            return { ok: false, status: 429, error: 'Rate limit exceeded.' };
        }
        return { ok: true };
    }
}

export function applyCors(req, res, methods = ['POST', 'OPTIONS']) {
    const allowedOrigins = getAllowedOrigins();
    const origin = req.headers?.origin || '';

    let allowOrigin = '*';
    if (!allowedOrigins.includes('*')) {
        if (origin && allowedOrigins.includes(origin)) {
            allowOrigin = origin;
        } else {
            allowOrigin = allowedOrigins[0] || 'https://theoremis.com';
        }
    }

    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (allowOrigin !== '*') res.setHeader('Vary', 'Origin');
}

export function handlePreflight(req, res) {
    if (req.method !== 'OPTIONS') return false;
    res.status(204).end();
    return true;
}

export function requireMethod(req, res, method) {
    if (req.method === method) return true;
    sendError(res, 405, `Method not allowed. Use ${method}.`);
    return false;
}

export function sendError(res, status, error, details) {
    const payload = { ok: false, error };
    if (details !== undefined) payload.details = details;
    return res.status(status).json(payload);
}

export function parseTypeCheckMode(value, defaultMode = 'permissive') {
    return value === 'strict' || value === 'permissive' ? value : defaultMode;
}

export function parseAnalyzeOptions(body, defaultTypeCheckMode = 'permissive') {
    const numTests = typeof body?.numTests === 'number'
        ? Math.min(Math.max(1, Math.trunc(body.numTests)), MAX_NUM_TESTS)
        : undefined;
    const seed = typeof body?.seed === 'number' ? Math.trunc(body.seed) : undefined;
    const timeoutMs = typeof body?.timeoutMs === 'number'
        ? Math.min(Math.max(1, Math.trunc(body.timeoutMs)), MAX_TIMEOUT_MS)
        : undefined;
    const maxCounterexamples = typeof body?.maxCounterexamples === 'number'
        ? Math.min(Math.max(1, Math.trunc(body.maxCounterexamples)), MAX_COUNTEREXAMPLES)
        : undefined;
    const maxWorkItems = typeof body?.maxWorkItems === 'number'
        ? Math.min(Math.max(1, Math.trunc(body.maxWorkItems)), MAX_WORK_ITEMS)
        : undefined;

    const typeCheckMode = parseTypeCheckMode(body?.typeCheckMode, defaultTypeCheckMode);

    return {
        numTests,
        seed,
        timeoutMs,
        maxCounterexamples,
        maxWorkItems,
        typeCheckMode,
    };
}
