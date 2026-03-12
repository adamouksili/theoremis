import { describe, expect, it } from 'vitest';
import { collectObligations } from '../../formal/lean/obligations';

describe('formal obligations', () => {
    it('counts sorry/admit and unsolved diagnostics', () => {
        const obligations = collectObligations(
            [
                { path: 'Main.lean', content: 'theorem t : True := by\n  sorry\n\naxiom x : True\n' },
                { path: 'Aux.lean', content: 'theorem u : True := by\n  admit\n' },
            ],
            [
                { file: 'Main.lean', line: 1, column: 1, severity: 'error', message: 'unsolved goals' },
                { file: 'Main.lean', line: 2, column: 1, severity: 'warning', message: 'some warning' },
            ],
        );

        expect(obligations.sorryCount).toBe(1);
        expect(obligations.admitCount).toBe(1);
        expect(obligations.unsolvedGoals).toBe(1);
    });

    it('returns zero for clean input', () => {
        const obligations = collectObligations(
            [{ path: 'Main.lean', content: 'theorem t : True := by\n  trivial\n' }],
            [],
        );

        expect(obligations).toEqual({ sorryCount: 0, admitCount: 0, unsolvedGoals: 0 });
    });

    it('ignores sorry inside block comments', () => {
        const obligations = collectObligations(
            [{ path: 'A.lean', content: '/- sorry -/\ntheorem t := trivial' }],
            [],
        );
        expect(obligations.sorryCount).toBe(0);
    });

    it('ignores sorry inside nested block comments', () => {
        const obligations = collectObligations(
            [{ path: 'A.lean', content: '/- outer /- sorry -/ still comment -/\ntheorem t := trivial' }],
            [],
        );
        expect(obligations.sorryCount).toBe(0);
    });

    it('ignores sorry inside single-line comments', () => {
        const obligations = collectObligations(
            [{ path: 'A.lean', content: '-- sorry\ntheorem t := trivial' }],
            [],
        );
        expect(obligations.sorryCount).toBe(0);
    });

    it('ignores sorry inside string literals', () => {
        const obligations = collectObligations(
            [{ path: 'A.lean', content: 'def msg := "sorry about that"\ntheorem t := trivial' }],
            [],
        );
        expect(obligations.sorryCount).toBe(0);
    });

    it('ignores sorry inside string with escaped quote', () => {
        const obligations = collectObligations(
            [{ path: 'A.lean', content: 'def msg := "he said \\"sorry\\""\ntheorem t := trivial' }],
            [],
        );
        expect(obligations.sorryCount).toBe(0);
    });

    it('counts multiple sorry and admit in one file', () => {
        const content = [
            'theorem a := by sorry',
            'theorem b := by sorry',
            'theorem c := by admit',
            'theorem d := by admit',
            'theorem e := by admit',
        ].join('\n');
        const obligations = collectObligations(
            [{ path: 'A.lean', content }],
            [],
        );
        expect(obligations.sorryCount).toBe(2);
        expect(obligations.admitCount).toBe(3);
    });

    it('counts sorry outside comments even when comments also present', () => {
        const content = '/- sorry -/\ntheorem t := by\n  sorry\n-- sorry';
        const obligations = collectObligations(
            [{ path: 'A.lean', content }],
            [],
        );
        expect(obligations.sorryCount).toBe(1);
    });

    it('matches various unsolved goal diagnostic messages', () => {
        const diagnostics = [
            { file: 'A.lean', line: 1, column: 1, severity: 'error' as const, message: 'unsolved goals' },
            { file: 'A.lean', line: 2, column: 1, severity: 'error' as const, message: 'goals remaining' },
            { file: 'A.lean', line: 3, column: 1, severity: 'error' as const, message: 'declaration has sorry' },
            { file: 'A.lean', line: 4, column: 1, severity: 'error' as const, message: 'contains sorry' },
            { file: 'A.lean', line: 5, column: 1, severity: 'warning' as const, message: 'unrelated warning' },
        ];
        const obligations = collectObligations([], diagnostics);
        expect(obligations.unsolvedGoals).toBe(4);
    });

    it('handles empty files array', () => {
        const obligations = collectObligations([], []);
        expect(obligations).toEqual({ sorryCount: 0, admitCount: 0, unsolvedGoals: 0 });
    });

    it('handles file with only comments', () => {
        const content = '/- block comment -/\n-- line comment\n/- /- nested -/ -/';
        const obligations = collectObligations(
            [{ path: 'A.lean', content }],
            [],
        );
        expect(obligations).toEqual({ sorryCount: 0, admitCount: 0, unsolvedGoals: 0 });
    });

    it('handles file with only string literals', () => {
        const content = '"hello"\n"world"\n"sorry admit"';
        const obligations = collectObligations(
            [{ path: 'A.lean', content }],
            [],
        );
        expect(obligations.sorryCount).toBe(0);
        expect(obligations.admitCount).toBe(0);
    });

    it('counts across multiple files', () => {
        const obligations = collectObligations(
            [
                { path: 'A.lean', content: 'sorry' },
                { path: 'B.lean', content: 'sorry\nsorry' },
                { path: 'C.lean', content: 'admit' },
            ],
            [],
        );
        expect(obligations.sorryCount).toBe(3);
        expect(obligations.admitCount).toBe(1);
    });
});
