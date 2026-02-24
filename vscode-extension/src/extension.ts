// ─────────────────────────────────────────────────────────────
// Theoremis VS Code Extension — Entry Point
// ─────────────────────────────────────────────────────────────

import * as vscode from 'vscode';

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

export function activate(context: vscode.ExtensionContext) {
    console.log('Theoremis extension activated');

    // ── Verify command ──────────────────────────────────────
    const verifyCmd = vscode.commands.registerCommand('theoremis.verify', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }

        const source = editor.document.getText();
        const config = vscode.workspace.getConfiguration('theoremis');
        const bridgePort = config.get<number>('bridgePort', 9473);

        try {
            const res = await fetch(`http://localhost:${bridgePort}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: source, language: 'lean4' }),
            });

            if (!res.ok) throw new Error(`Bridge returned ${res.status}`);
            const result = await res.json() as VerifyResponse;

            if (result.success) {
                vscode.window.showInformationMessage('Lean 4 verification passed');
            } else {
                const errors = result.errors.map((e) => `L${e.line}: ${e.message}`).join('\n');
                vscode.window.showErrorMessage(`Verification failed:\n${errors}`);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(
                `Bridge not running. Start with: npx ts-node src/bridge/lean-server.ts\n${msg}`
            );
        }
    });

    // ── Emit commands ───────────────────────────────────────
    const emitLean = vscode.commands.registerCommand('theoremis.emitLean', () => {
        emitToNewDocument('lean4');
    });

    const emitCoq = vscode.commands.registerCommand('theoremis.emitCoq', () => {
        emitToNewDocument('coq');
    });

    const emitIsabelle = vscode.commands.registerCommand('theoremis.emitIsabelle', () => {
        emitToNewDocument('isabelle');
    });

    // ── Annotated export ────────────────────────────────────
    const exportAnnotated = vscode.commands.registerCommand('theoremis.exportAnnotated', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        vscode.window.showInformationMessage(
            'Annotated LaTeX export: Use the web IDE for full annotated export with verification status annotations.'
        );
    });

    context.subscriptions.push(verifyCmd, emitLean, emitCoq, emitIsabelle, exportAnnotated);

    // ── Diagnostics on save ─────────────────────────────────
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('theoremis');
    context.subscriptions.push(diagnosticCollection);

    const config = vscode.workspace.getConfiguration('theoremis');
    if (config.get<boolean>('autoVerify', true)) {
        vscode.workspace.onDidSaveTextDocument(async (doc) => {
            if (doc.languageId === 'latex' || doc.languageId === 'tex' || doc.fileName.endsWith('.tex')) {
                vscode.commands.executeCommand('theoremis.verify');
            }
        });
    }
}

async function emitToNewDocument(language: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // For now, show a message directing to the web IDE
    // Full implementation would import the parser/emitters directly
    const ext = language === 'lean4' ? 'lean' : language === 'coq' ? 'v' : 'thy';
    vscode.window.showInformationMessage(
        `Theoremis: ${language} emission — use the web IDE or run the CLI for full code generation. Output: *.${ext}`
    );
}

export function deactivate() {
    console.log('Theoremis extension deactivated');
}
