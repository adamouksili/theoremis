import type { NormalizedDiagnostic } from './types';

const LINE_RE = /^([^:\n]+):(\d+):(\d+):\s*(error|warning|information):\s*(.*)$/;

function severityMap(value: string): 'error' | 'warning' | 'info' {
    if (value === 'error') return 'error';
    if (value === 'warning') return 'warning';
    return 'info';
}

export function normalizeLeanDiagnostics(output: string): NormalizedDiagnostic[] {
    const diagnostics: NormalizedDiagnostic[] = [];
    const seen = new Set<string>();

    for (const rawLine of output.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;

        const match = line.match(LINE_RE);
        if (!match) continue;

        const diag: NormalizedDiagnostic = {
            file: match[1],
            line: Number.parseInt(match[2], 10),
            column: Number.parseInt(match[3], 10),
            severity: severityMap(match[4]),
            message: match[5].trim(),
        };

        const key = `${diag.severity}:${diag.file}:${diag.line}:${diag.column}:${diag.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        diagnostics.push(diag);
    }

    diagnostics.sort((a, b) => {
        if (a.file !== b.file) return a.file.localeCompare(b.file);
        if (a.line !== b.line) return a.line - b.line;
        if (a.column !== b.column) return a.column - b.column;
        if (a.severity !== b.severity) return a.severity.localeCompare(b.severity);
        return a.message.localeCompare(b.message);
    });

    return diagnostics;
}
