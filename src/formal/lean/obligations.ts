import type { NormalizedDiagnostic, VerificationFile, VerificationObligations } from './types';

const SORRY_RE = /\bsorry\b/g;
const ADMIT_RE = /\badmit\b/g;
const UNSOLVED_RE = /(unsolved goals?|goals? remaining|declaration has sorry|contains sorry)/i;

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
        sorryCount += countMatches(file.content, SORRY_RE);
        admitCount += countMatches(file.content, ADMIT_RE);
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
