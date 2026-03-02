#!/usr/bin/env node

// ─────────────────────────────────────────────────────────────
// Theoremis CLI — `theoremis check`
// Validates .tex files via the Theoremis pipeline
// Designed for CI/CD: exit code 0 = pass, 1 = failures found
// ─────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, extname, relative } from 'path';
import { apiParse, apiEmit, apiAnalyze } from '../src/api/pipeline';
import type { AnalyzeResult } from '../src/api/pipeline';

// ── CLI argument parsing ────────────────────────────────────

interface CLIOptions {
    files: string[];
    axiomBundle: string;
    strict: boolean;
    emit: string[];
    numTests: number;
    format: 'text' | 'json' | 'github';
    failOnWarnings: boolean;
}

function parseArgs(argv: string[]): CLIOptions {
    const opts: CLIOptions = {
        files: [],
        axiomBundle: 'ClassicalMath',
        strict: false,
        emit: [],
        numTests: 500,
        format: 'text',
        failOnWarnings: false,
    };

    let i = 2; // skip node + script
    while (i < argv.length) {
        const arg = argv[i];
        if (arg === '--bundle' || arg === '-b') { opts.axiomBundle = argv[++i]; }
        else if (arg === '--strict') { opts.strict = true; }
        else if (arg === '--emit' || arg === '-e') { opts.emit.push(argv[++i]); }
        else if (arg === '--tests' || arg === '-t') { opts.numTests = parseInt(argv[++i], 10); }
        else if (arg === '--format' || arg === '-f') { opts.format = argv[++i] as CLIOptions['format']; }
        else if (arg === '--fail-on-warnings') { opts.failOnWarnings = true; }
        else if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0); }
        else if (arg === '--version' || arg === '-v') { console.log('theoremis 0.1.0'); process.exit(0); }
        else if (!arg.startsWith('-')) { opts.files.push(arg); }
        else { console.error(`Unknown option: ${arg}`); process.exit(1); }
        i++;
    }

    return opts;
}

function printHelp(): void {
    console.log(`
  theoremis check [options] [files...]

  Validate LaTeX math files through the Theoremis pipeline.

  Options:
    --bundle, -b <name>    Axiom bundle (default: ClassicalMath)
    --strict               Fail on type-check warnings, not just errors
    --emit, -e <target>    Also emit to target (lean4, coq, isabelle)
    --tests, -t <n>        Number of QuickCheck tests per theorem (default: 500)
    --format, -f <fmt>     Output format: text, json, github (default: text)
    --fail-on-warnings     Treat warnings as failures
    --help, -h             Show this help
    --version, -v          Show version

  Examples:
    theoremis check paper.tex
    theoremis check src/**/*.tex --strict --emit lean4
    theoremis check . --format github     # GitHub Actions annotations

  Exit codes:
    0  All checks passed
    1  One or more checks failed
    2  No .tex files found
`);
}

// ── File discovery ──────────────────────────────────────────

function discoverTexFiles(paths: string[]): string[] {
    const files: string[] = [];

    for (const p of paths) {
        const resolved = resolve(p);
        if (!existsSync(resolved)) {
            console.error(`File not found: ${p}`);
            continue;
        }
        const stat = statSync(resolved);
        if (stat.isDirectory()) {
            // Recursively find .tex files
            walkDir(resolved, files);
        } else if (extname(resolved) === '.tex') {
            files.push(resolved);
        }
    }

    return files;
}

function walkDir(dir: string, out: string[]): void {
    for (const entry of readdirSync(dir)) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        const full = resolve(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) walkDir(full, out);
        else if (extname(full) === '.tex') out.push(full);
    }
}

// ── File check ──────────────────────────────────────────────

interface FileReport {
    file: string;
    passed: boolean;
    parseTime: number;
    typeCheckValid: boolean;
    diagnostics: Array<{ severity: string; message: string }>;
    theorems: Array<{
        name: string;
        quickCheckPassed: boolean;
        quickCheckFailed: number;
        quickCheckTotal: number;
    }>;
    emitWarnings: Record<string, string[]>;
    errors: string[];
}

function checkFile(filePath: string, opts: CLIOptions): FileReport {
    const report: FileReport = {
        file: filePath,
        passed: true,
        parseTime: 0,
        typeCheckValid: true,
        diagnostics: [],
        theorems: [],
        emitWarnings: {},
        errors: [],
    };

    let latex: string;
    try {
        latex = readFileSync(filePath, 'utf-8');
    } catch (err) {
        report.passed = false;
        report.errors.push(`Cannot read file: ${err instanceof Error ? err.message : String(err)}`);
        return report;
    }

    // Parse + typecheck
    try {
        const parseResult = apiParse(latex, opts.axiomBundle);
        report.parseTime = parseResult.elapsed;

        const tc = parseResult.typeCheck as Record<string, unknown>;
        report.typeCheckValid = tc.valid as boolean;
        report.diagnostics = (tc.diagnostics as Array<{ severity: string; message: string }>) ?? [];

        if (!report.typeCheckValid) report.passed = false;
        if (opts.failOnWarnings && report.diagnostics.some(d => d.severity === 'warning')) {
            report.passed = false;
        }
    } catch (err) {
        report.passed = false;
        report.errors.push(`Parse/typecheck failed: ${err instanceof Error ? err.message : String(err)}`);
        return report;
    }

    // Analyze (QuickCheck)
    try {
        const analysis: AnalyzeResult = apiAnalyze(latex, opts.axiomBundle, opts.numTests);

        for (const thm of analysis.theorems) {
            const qc = thm.quickCheck as Record<string, unknown> | null;
            const failed = qc ? (qc.failed as number) : 0;
            const total = qc ? (qc.totalTests as number) : 0;
            const thmReport = {
                name: thm.name,
                quickCheckPassed: failed === 0,
                quickCheckFailed: failed,
                quickCheckTotal: total,
            };
            report.theorems.push(thmReport);

            if (failed > 0) report.passed = false;
        }
    } catch (err) {
        report.errors.push(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Emit (optional)
    if (opts.emit.length > 0) {
        try {
            const emitResult = apiEmit(latex, opts.axiomBundle, opts.emit);
            for (const target of opts.emit) {
                const t = target as keyof typeof emitResult;
                const result = emitResult[t];
                if (result && result.warnings.length > 0) {
                    report.emitWarnings[target] = result.warnings;
                    if (opts.strict) report.passed = false;
                }
            }
        } catch (err) {
            report.errors.push(`Emit failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    return report;
}

// ── Formatters ──────────────────────────────────────────────

function formatText(reports: FileReport[]): string {
    const lines: string[] = [];
    const total = reports.length;
    const passed = reports.filter(r => r.passed).length;
    const failed = total - passed;

    lines.push('');
    lines.push('  ╔══════════════════════════════════════════════╗');
    lines.push('  ║         Theoremis · Proof Check              ║');
    lines.push('  ╚══════════════════════════════════════════════╝');
    lines.push('');

    for (const r of reports) {
        const icon = r.passed ? '✓' : '✗';
        const rel = relative(process.cwd(), r.file);
        lines.push(`  ${icon} ${rel}  (${r.parseTime}ms)`);

        if (!r.typeCheckValid) {
            lines.push('    ⚠ Type-check failed');
        }

        for (const d of r.diagnostics) {
            lines.push(`    ${d.severity === 'error' ? '✗' : '⚠'} ${d.message}`);
        }

        for (const thm of r.theorems) {
            if (thm.quickCheckFailed > 0) {
                lines.push(`    ✗ ${thm.name}: ${thm.quickCheckFailed}/${thm.quickCheckTotal} tests failed`);
            } else if (thm.quickCheckTotal > 0) {
                lines.push(`    ✓ ${thm.name}: ${thm.quickCheckTotal} tests passed`);
            }
        }

        for (const [target, warnings] of Object.entries(r.emitWarnings)) {
            lines.push(`    ⚠ ${target}: ${warnings.length} emission warnings`);
        }

        for (const err of r.errors) {
            lines.push(`    ✗ ${err}`);
        }

        lines.push('');
    }

    lines.push('  ─────────────────────────────────────────────');
    lines.push(`  ${passed}/${total} files passed${failed > 0 ? ` · ${failed} failed` : ''}`);
    lines.push('');

    return lines.join('\n');
}

function formatJSON(reports: FileReport[]): string {
    return JSON.stringify({
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        total: reports.length,
        passed: reports.filter(r => r.passed).length,
        failed: reports.filter(r => !r.passed).length,
        files: reports.map(r => ({
            ...r,
            file: relative(process.cwd(), r.file),
        })),
    }, null, 2);
}

function formatGitHub(reports: FileReport[]): string {
    const lines: string[] = [];

    for (const r of reports) {
        const rel = relative(process.cwd(), r.file);

        for (const d of r.diagnostics) {
            const level = d.severity === 'error' ? 'error' : 'warning';
            lines.push(`::${level} file=${rel}::${d.message}`);
        }

        for (const thm of r.theorems) {
            if (thm.quickCheckFailed > 0) {
                lines.push(`::error file=${rel}::QuickCheck failed for ${thm.name}: ${thm.quickCheckFailed}/${thm.quickCheckTotal} tests failed`);
            }
        }

        for (const err of r.errors) {
            lines.push(`::error file=${rel}::${err}`);
        }
    }

    // Summary
    const total = reports.length;
    const passed = reports.filter(r => r.passed).length;
    if (passed === total) {
        lines.push(`::notice::Theoremis: All ${total} files passed ✓`);
    } else {
        lines.push(`::error::Theoremis: ${total - passed}/${total} files failed`);
    }

    return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────

function main(): void {
    const opts = parseArgs(process.argv);

    if (opts.files.length === 0) {
        opts.files.push('.'); // Default: current directory
    }

    const files = discoverTexFiles(opts.files);

    if (files.length === 0) {
        console.error('No .tex files found.');
        process.exit(2);
    }

    const reports = files.map(f => checkFile(f, opts));

    switch (opts.format) {
        case 'json':
            console.log(formatJSON(reports));
            break;
        case 'github':
            console.log(formatGitHub(reports));
            break;
        default:
            console.log(formatText(reports));
            break;
    }

    const failed = reports.some(r => !r.passed);
    process.exit(failed ? 1 : 0);
}

main();
