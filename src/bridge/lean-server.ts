// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Lean 4 Verification Bridge
// Local server that compiles emitted Lean 4 code via `lean`
// Run: npx ts-node src/bridge/lean-server.ts
//
// WARNING — SECURITY: This server is for LOCAL development only.
//     It accepts arbitrary Lean code for execution and uses a
//     permissive CORS policy (Access-Control-Allow-Origin: *).
//     DO NOT expose this server to untrusted networks or the
//     public internet without adding authentication, rate-limiting,
//     and origin restrictions.
// ─────────────────────────────────────────────────────────────

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { execFile } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const exec = promisify(execFile);
const PORT = 9473;
const LEAN_TIMEOUT = 30_000;

/** Shape returned by promisified `execFile` on failure. */
interface ExecError extends Error {
    killed?: boolean;
    stderr?: string;
}

interface VerifyRequest {
    code: string;
    language: 'lean4' | 'coq' | 'isabelle';
}

interface VerifyResult {
    success: boolean;
    errors: LeanError[];
    warnings: LeanWarning[];
    elapsed: number;
}

interface LeanError {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning' | 'information';
}

type LeanWarning = LeanError;

// ── Find Lean binary ────────────────────────────────────────

async function findLean(): Promise<string> {
    const candidates = [
        'lean',
        join(process.env.HOME || '~', '.elan/bin/lean'),
        '/usr/local/bin/lean',
        '/opt/homebrew/bin/lean',
    ];

    for (const candidate of candidates) {
        try {
            await exec(candidate, ['--version'], { timeout: 5000 });
            return candidate;
        } catch {
            continue;
        }
    }

    throw new Error(
        'Lean 4 not found. Install via: curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh'
    );
}

// ── Parse Lean output ───────────────────────────────────────

function parseLeanOutput(stderr: string): LeanError[] {
    const errors: LeanError[] = [];
    // Lean error format: filename:line:col: severity: message
    const regex = /^[^:]+:(\d+):(\d+):\s*(error|warning|information):\s*(.+)/gm;
    let match;
    while ((match = regex.exec(stderr)) !== null) {
        errors.push({
            line: parseInt(match[1], 10),
            column: parseInt(match[2], 10),
            message: match[4].trim(),
            severity: match[3] as 'error' | 'warning' | 'information',
        });
    }
    return errors;
}

// ── Verify Lean code ────────────────────────────────────────

async function verifyLean(code: string): Promise<VerifyResult> {
    const leanBin = await findLean();
    const tmpDir = join(tmpdir(), 'theoremis');
    await mkdir(tmpDir, { recursive: true });
    const tmpFile = join(tmpDir, `check_${Date.now()}.lean`);

    const start = performance.now();

    try {
        await writeFile(tmpFile, code, 'utf-8');

        const { stdout, stderr } = await exec(leanBin, [tmpFile], {
            timeout: LEAN_TIMEOUT,
            env: { ...process.env, LEAN_PATH: process.env.LEAN_PATH || '' },
        });

        const elapsed = performance.now() - start;
        const parsed = parseLeanOutput(stderr + stdout);

        return {
            success: parsed.filter(e => e.severity === 'error').length === 0,
            errors: parsed.filter(e => e.severity === 'error'),
            warnings: parsed.filter(e => e.severity === 'warning' || e.severity === 'information'),
            elapsed,
        };
    } catch (err: unknown) {
        const elapsed = performance.now() - start;

        // Narrow to ExecError (which extends Error with optional killed/stderr)
        const isExecErr = (v: unknown): v is ExecError =>
            v instanceof Error;

        if (!isExecErr(err)) {
            return {
                success: false,
                errors: [{ line: 0, column: 0, message: String(err).slice(0, 500), severity: 'error' }],
                warnings: [],
                elapsed,
            };
        }

        if (err.killed) {
            return {
                success: false,
                errors: [{ line: 0, column: 0, message: `Lean timed out after ${LEAN_TIMEOUT}ms`, severity: 'error' }],
                warnings: [],
                elapsed,
            };
        }

        const stderr = err.stderr || err.message || 'Unknown error';
        const parsed = parseLeanOutput(stderr);

        if (parsed.length > 0) {
            return {
                success: parsed.filter(e => e.severity === 'error').length === 0,
                errors: parsed.filter(e => e.severity === 'error'),
                warnings: parsed.filter(e => e.severity === 'warning'),
                elapsed,
            };
        }

        return {
            success: false,
            errors: [{ line: 0, column: 0, message: stderr.slice(0, 500), severity: 'error' }],
            warnings: [],
            elapsed,
        };
    } finally {
        unlink(tmpFile).catch(() => { });
    }
}

// ── HTTP server ─────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

function cors(res: ServerResponse, req: IncomingMessage) {
    // Allow the configured origin, or default to local dev
    const allowed = (process.env.SIGMA_CORS_ORIGIN || 'http://localhost:5173').split(',');
    const origin = req.headers.origin || '';
    if (allowed.includes('*') || allowed.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else {
        res.setHeader('Access-Control-Allow-Origin', allowed[0]);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = createServer(async (req, res) => {
    cors(res, req);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/verify') {
        try {
            const body = JSON.parse(await readBody(req)) as VerifyRequest;

            if (body.language !== 'lean4') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Unsupported language: ${body.language}. Only lean4 is supported.` }));
                return;
            }

            const result = await verifyLean(body.code);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: msg }));
        }
        return;
    }

    if (req.method === 'GET' && req.url === '/health') {
        try {
            const lean = await findLean();
            const { stdout } = await exec(lean, ['--version'], { timeout: 5000 });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', lean: stdout.trim() }));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: msg }));
        }
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`\n  ╔══════════════════════════════════════════╗`);
    console.log(`  ║  Theoremis Lean Bridge · port ${PORT}       ║`);
    console.log(`  ║  POST /verify  { code, language }        ║`);
    console.log(`  ║  GET  /health                            ║`);
    console.log(`  ╚══════════════════════════════════════════╝\n`);
});
