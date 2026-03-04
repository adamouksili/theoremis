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
});
