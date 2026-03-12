// ─────────────────────────────────────────────────────────────
// Theoremis VS Code Extension
// ─────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { execFile as execFileCb } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Types ───────────────────────────────────────────────────

interface LeanDiagnostic {
    line: number;
    column: number;
    message: string;
    severity: string;
}

interface VerifyResponse {
    success: boolean;
    errors: LeanDiagnostic[];
    warnings: LeanDiagnostic[];
    elapsed: number;
}

interface EmitOutput {
    code: string;
    warnings: string[];
}

const TARGET_LANG: Record<string, string> = {
    lean4: 'lean4',
    coq: 'coq',
    isabelle: 'isabelle',
};

// ── Pipeline scripts (run via tsx in the project root) ──────
// These are written to temp files and executed as child processes.
// They use relative imports resolved against the project root.

const EMIT_SCRIPT = `\
import { readFileSync } from 'fs';
import { apiEmit } from './src/api/pipeline';
const [texFile, target] = process.argv.slice(2);
const latex = readFileSync(texFile!, 'utf-8');
const result = apiEmit(latex, undefined, [target!]);
const output = result[target! as keyof typeof result];
if (output) console.log(JSON.stringify(output));
else { console.error('Unknown emit target: ' + target); process.exit(1); }
`;

const ANNOTATE_SCRIPT = `\
import { readFileSync } from 'fs';
import { parseLatex, documentToIR } from './src/parser/latex';
import { typeCheck } from './src/core/typechecker';
import { emitLean4 } from './src/emitters/lean4';
import { exportAnnotatedLaTeX } from './src/emitters/annotated-latex';
const latex = readFileSync(process.argv[2]!, 'utf-8');
const doc = parseLatex(latex);
const ir = documentToIR(doc);
const tc = typeCheck(ir);
const lean = emitLean4(ir);
process.stdout.write(exportAnnotatedLaTeX(latex, ir, tc, lean));
`;

// ── Extension state ─────────────────────────────────────────

let outputChannel: vscode.OutputChannel;
let statusBar: vscode.StatusBarItem;
let diagnosticCollection: vscode.DiagnosticCollection;

// ── Activate / Deactivate ───────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Theoremis');
    diagnosticCollection = vscode.languages.createDiagnosticCollection('theoremis');

    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = '$(beaker) Theoremis';
    statusBar.tooltip = 'Click to verify current document';
    statusBar.command = 'theoremis.verify';
    statusBar.show();

    context.subscriptions.push(
        outputChannel,
        diagnosticCollection,
        statusBar,
        vscode.commands.registerCommand('theoremis.verify', runVerify),
        vscode.commands.registerCommand('theoremis.emitLean', () => runEmit('lean4')),
        vscode.commands.registerCommand('theoremis.emitCoq', () => runEmit('coq')),
        vscode.commands.registerCommand('theoremis.emitIsabelle', () => runEmit('isabelle')),
        vscode.commands.registerCommand('theoremis.exportAnnotated', runExportAnnotated),
    );

    const config = vscode.workspace.getConfiguration('theoremis');
    if (config.get<boolean>('autoVerify', true)) {
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument((doc) => {
                if (isTexDocument(doc)) {
                    vscode.commands.executeCommand('theoremis.verify');
                }
            }),
        );
    }

    outputChannel.appendLine('Theoremis extension activated');
}

export function deactivate(): void {
    diagnosticCollection?.clear();
    diagnosticCollection?.dispose();
    statusBar?.dispose();
    outputChannel?.appendLine('Theoremis extension deactivated');
    outputChannel?.dispose();
}

// ── Verify (bridge-based with diagnostics mapping) ──────────

async function runVerify(): Promise<void> {
    const ctx = requireActiveEditor();
    if (!ctx) return;

    const config = vscode.workspace.getConfiguration('theoremis');
    const port = config.get<number>('bridgePort', 9473);

    setStatus('$(sync~spin) Verifying...');

    try {
        const res = await fetch(`http://localhost:${port}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: ctx.source, language: 'lean4' }),
        });

        if (!res.ok) throw new Error(`Bridge returned ${res.status}`);
        const result = (await res.json()) as VerifyResponse;

        const diags: vscode.Diagnostic[] = [
            ...result.errors.map((d) => toDiagnostic(d, vscode.DiagnosticSeverity.Error)),
            ...result.warnings.map((d) => toDiagnostic(d, vscode.DiagnosticSeverity.Warning)),
        ];
        diagnosticCollection.set(ctx.editor.document.uri, diags);

        if (result.success) {
            setStatus('$(check) Theoremis: Verified');
            vscode.window.showInformationMessage(
                `Theoremis: Verification passed (${result.elapsed}ms)`,
            );
        } else {
            setStatus(`$(error) Theoremis: ${result.errors.length} error(s)`, 'error');
            vscode.window.showErrorMessage(
                `Theoremis: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`,
            );
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus('$(warning) Theoremis: Bridge offline', 'warning');
        outputChannel.appendLine(`[verify] ${msg}`);
        vscode.window.showErrorMessage(
            'Theoremis: Lean bridge not running. Start with: npx tsx src/bridge/lean-server.ts',
        );
    }
}

function toDiagnostic(
    d: LeanDiagnostic,
    severity: vscode.DiagnosticSeverity,
): vscode.Diagnostic {
    const line = Math.max(0, d.line - 1);
    const range = new vscode.Range(line, d.column, line, Number.MAX_SAFE_INTEGER);
    const diag = new vscode.Diagnostic(range, d.message, severity);
    diag.source = 'Theoremis (Lean 4)';
    return diag;
}

// ── Emit commands (lean4, coq, isabelle) ────────────────────

async function runEmit(target: string): Promise<void> {
    const ctx = requireActiveEditor();
    if (!ctx) return;
    const projectRoot = requireProjectRoot();
    if (!projectRoot) return;

    setStatus(`$(sync~spin) Emitting ${target}...`);

    try {
        const raw = await runPipelineScript(projectRoot, ctx.source, EMIT_SCRIPT, [target]);
        const output: EmitOutput = JSON.parse(raw);

        if (output.warnings.length > 0) {
            outputChannel.appendLine(`[emit:${target}] ${output.warnings.length} warning(s):`);
            for (const w of output.warnings) outputChannel.appendLine(`  - ${w}`);
        }

        const langId = TARGET_LANG[target] ?? target;
        const doc = await vscode.workspace.openTextDocument({
            content: output.code,
            language: langId,
        });
        await vscode.window.showTextDocument(doc, { preview: false });

        setStatus('$(beaker) Theoremis');
    } catch (err: unknown) {
        showPipelineError(`emit:${target}`, err);
    }
}

// ── Export annotated LaTeX ──────────────────────────────────

async function runExportAnnotated(): Promise<void> {
    const ctx = requireActiveEditor();
    if (!ctx) return;
    const projectRoot = requireProjectRoot();
    if (!projectRoot) return;

    setStatus('$(sync~spin) Exporting annotated...');

    try {
        const annotated = await runPipelineScript(projectRoot, ctx.source, ANNOTATE_SCRIPT);
        const doc = await vscode.workspace.openTextDocument({
            content: annotated,
            language: 'latex',
        });
        await vscode.window.showTextDocument(doc, { preview: false });

        setStatus('$(beaker) Theoremis');
    } catch (err: unknown) {
        showPipelineError('annotate', err);
    }
}

// ── CLI execution helpers ───────────────────────────────────

function resolveTsx(projectRoot: string): { cmd: string; prefix: string[] } {
    const local = path.join(projectRoot, 'node_modules', '.bin', 'tsx');
    if (existsSync(local)) return { cmd: local, prefix: [] };
    return { cmd: 'npx', prefix: ['tsx'] };
}

async function runPipelineScript(
    projectRoot: string,
    latexSource: string,
    script: string,
    extraArgs: string[] = [],
): Promise<string> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const texFile = path.join(os.tmpdir(), `theoremis-src-${id}.tex`);
    const scriptFile = path.join(projectRoot, `.theoremis-tmp-${id}.ts`);

    writeFileSync(texFile, latexSource, 'utf-8');
    writeFileSync(scriptFile, script, 'utf-8');

    const { cmd, prefix } = resolveTsx(projectRoot);

    try {
        const { stdout, stderr } = await execFileAsync(
            cmd,
            [...prefix, scriptFile, texFile, ...extraArgs],
            { cwd: projectRoot, timeout: 30_000 },
        );
        if (stderr) outputChannel.appendLine(`[pipeline] ${stderr.trim()}`);
        return stdout;
    } finally {
        silentCleanup(texFile);
        silentCleanup(scriptFile);
    }
}

function execFileAsync(
    command: string,
    args: string[],
    options: { cwd: string; timeout: number },
): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        execFileCb(
            command,
            args,
            { ...options, maxBuffer: 10 * 1024 * 1024 },
            (error, stdout, stderr) => {
                if (error) {
                    const enriched = error as Error & { stdout?: string; stderr?: string };
                    enriched.stdout = stdout;
                    enriched.stderr = stderr;
                    reject(enriched);
                } else {
                    resolve({ stdout, stderr });
                }
            },
        );
    });
}

function silentCleanup(filePath: string): void {
    try { unlinkSync(filePath); } catch { /* best-effort */ }
}

// ── Shared utilities ────────────────────────────────────────

function isTexDocument(doc: vscode.TextDocument): boolean {
    return (
        doc.languageId === 'latex' ||
        doc.languageId === 'tex' ||
        doc.fileName.endsWith('.tex')
    );
}

function getProjectRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return undefined;

    for (const folder of folders) {
        if (existsSync(path.join(folder.uri.fsPath, 'cli', 'check.ts'))) {
            return folder.uri.fsPath;
        }
    }
    // Check one level up (e.g. workspace opened inside vscode-extension/)
    for (const folder of folders) {
        const parent = path.dirname(folder.uri.fsPath);
        if (existsSync(path.join(parent, 'cli', 'check.ts'))) return parent;
    }
    return undefined;
}

function requireActiveEditor(): { source: string; editor: vscode.TextEditor } | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Theoremis: No active editor');
        return undefined;
    }
    return { source: editor.document.getText(), editor };
}

function requireProjectRoot(): string | undefined {
    const root = getProjectRoot();
    if (!root) {
        vscode.window.showErrorMessage(
            'Theoremis: Cannot locate project root. Open the Theoremis workspace folder.',
        );
    }
    return root;
}

function setStatus(text: string, bg?: 'error' | 'warning'): void {
    statusBar.text = text;
    statusBar.backgroundColor = bg
        ? new vscode.ThemeColor(`statusBarItem.${bg}Background`)
        : undefined;
}

function showPipelineError(label: string, err: unknown): void {
    const errObj = err as Error & { stderr?: string };
    const stderr = errObj.stderr?.trim();
    const msg = stderr || errObj.message || String(err);

    setStatus('$(error) Theoremis', 'error');
    outputChannel.appendLine(`[${label}] Error: ${msg}`);
    if (stderr && stderr !== msg) outputChannel.appendLine(stderr);
    outputChannel.show(true);
    vscode.window.showErrorMessage(`Theoremis: ${label} failed — check Output panel`);
}
