import { describe, expect, it } from 'vitest';
import { normalizeLeanDiagnostics } from '../../formal/lean/diagnostics';

describe('formal diagnostics normalization', () => {
    it('parses lean diagnostics and sorts them', () => {
        const input = [
            'B.lean:10:3: warning: use simp',
            'A.lean:2:1: error: unknown identifier',
            'A.lean:2:1: error: unknown identifier',
            'A.lean:5:9: information: hint',
        ].join('\n');

        const diagnostics = normalizeLeanDiagnostics(input);
        expect(diagnostics).toHaveLength(3);
        expect(diagnostics[0].file).toBe('A.lean');
        expect(diagnostics[0].severity).toBe('error');
        expect(diagnostics[2].file).toBe('B.lean');
        expect(diagnostics[2].severity).toBe('warning');
    });

    it('ignores non-diagnostic lines', () => {
        const diagnostics = normalizeLeanDiagnostics('random text\nno match');
        expect(diagnostics).toEqual([]);
    });
});
