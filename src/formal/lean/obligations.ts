import type { NormalizedDiagnostic, VerificationFile, VerificationObligations } from './types';

const SORRY_RE = /\bsorry\b/g;
const ADMIT_RE = /\badmit\b/g;
const UNSOLVED_RE = /(unsolved goals?|goals? remaining|declaration has sorry|contains sorry)/i;

/**
 * Strip Lean 4 comments and string literals so that `sorry` / `admit`
 * inside them are not counted as proof obligations.
 */
function stripCommentsAndStrings(source: string): string {
    let result = '';
    let i = 0;
    while (i < source.length) {
        // Block comment /- ... -/  (supports nesting)
        if (source[i] === '/' && source[i + 1] === '-') {
            let depth = 1;
            i += 2;
            while (i < source.length && depth > 0) {
                if (source[i] === '/' && source[i + 1] === '-') { depth++; i += 2; }
                else if (source[i] === '-' && source[i + 1] === '/') { depth--; i += 2; }
                else { i++; }
            }
            continue;
        }
        // Single-line comment -- ...
        if (source[i] === '-' && source[i + 1] === '-') {
            while (i < source.length && source[i] !== '\n') i++;
            continue;
        }
        // String literal "..."
        if (source[i] === '"') {
            i++; // skip opening quote
            while (i < source.length && source[i] !== '"') {
                if (source[i] === '\\') i++; // skip escaped char
                i++;
            }
            i++; // skip closing quote
            continue;
        }
        result += source[i];
        i++;
    }
    return result;
}

function countMatches(text: string, re: RegExp): number {
    const matches = text.match(re);
    return matches ? matches.length : 0;
}

export function collectObligations(
    files: VerificationFile[],
    diagnostics: NormalizedDiagnostic[],
): VerificationObligations {
    let sorryCount = 0;
    let admitCount = 0;

    for (const file of files) {
        const stripped = stripCommentsAndStrings(file.content);
        sorryCount += countMatches(stripped, SORRY_RE);
        admitCount += countMatches(stripped, ADMIT_RE);
    }

    let unsolvedGoals = 0;
    for (const diag of diagnostics) {
        if (UNSOLVED_RE.test(diag.message)) unsolvedGoals += 1;
    }

    return {
        sorryCount,
        admitCount,
        unsolvedGoals,
    };
}
