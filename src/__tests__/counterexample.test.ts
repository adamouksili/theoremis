import { describe, it, expect } from 'vitest';
import { formatReport, runCounterexampleEngine, type PathologyReport, type CounterexampleResult, type Witness } from '../engine/counterexample';
import { mk, Types, BUNDLES, type Theorem } from '../core/ir';

// ── formatReport ─────────────────────────────────────────────

describe('formatReport', () => {
    function makeMutation(desc: string) {
        return { type: 'drop_hypothesis' as const, description: desc, original: mk.nat(1), mutated: mk.nat(1), params: [] };
    }

    it('formats a report with counterexample found', () => {
        const witness: Witness = {
            assignments: new Map([['n', '42'], ['m', '7']]),
            description: 'Found in 3/500 tests: dropped h',
        };
        const result: CounterexampleResult = {
            mutation: makeMutation('Drop hypothesis h'),
            status: 'counterexample_found',
            witness,
            confidence: 0.9,
            searchTime: 123.456,
            modelClass: 'random_testing',
            testsRun: 500,
        };
        const report: PathologyReport = {
            theoremName: 'my_theorem',
            results: [result],
            overallConfidence: 0.5,
            timestamp: Date.now(),
            summary: 'Theorem "my_theorem": 1 counterexample(s) found in 1 mutations, 0 safe.',
        };

        const text = formatReport(report);

        expect(text).toContain('══════ Pathology Report: my_theorem ══════');
        expect(text).toContain('Overall Confidence: 50.0%');
        expect(text).toContain('Mutations Tested: 1');
        expect(text).toContain('✗ [CE FOUND] Drop hypothesis h');
        expect(text).toContain('└─ Found in 3/500 tests: dropped h');
        expect(text).toContain('n = 42');
        expect(text).toContain('m = 7');
        expect(text).toContain('random_testing');
        expect(text).toContain('123ms');
        expect(text).toContain('500 tests');
        expect(text).toContain('conf: 90%');
    });

    it('formats a report with no counterexample', () => {
        const result: CounterexampleResult = {
            mutation: makeMutation('Weaken condition'),
            status: 'no_counterexample',
            confidence: 0.95,
            searchTime: 50,
            modelClass: 'random_testing',
            testsRun: 500,
        };
        const report: PathologyReport = {
            theoremName: 'safe_thm',
            results: [result],
            overallConfidence: 1.0,
            timestamp: Date.now(),
            summary: 'No counterexamples found.',
        };

        const text = formatReport(report);

        expect(text).toContain('✓ [SAFE] Weaken condition');
        expect(text).not.toContain('└─');
    });

    it('formats a report with timeout status', () => {
        const result: CounterexampleResult = {
            mutation: makeMutation('Perturb constant'),
            status: 'timeout',
            confidence: 0.3,
            searchTime: 5000,
            modelClass: 'unevaluable',
            testsRun: 0,
        };
        const report: PathologyReport = {
            theoremName: 'timeout_thm',
            results: [result],
            overallConfidence: 0.0,
            timestamp: Date.now(),
            summary: 'Timed out.',
        };

        const text = formatReport(report);

        expect(text).toContain('? [TIMEOUT] Perturb constant');
    });

    it('formats a report with multiple mixed results', () => {
        const results: CounterexampleResult[] = [
            {
                mutation: makeMutation('Mutation A'),
                status: 'counterexample_found',
                witness: { assignments: new Map([['x', '1']]), description: 'found' },
                confidence: 0.8,
                searchTime: 10,
                modelClass: 'random',
                testsRun: 100,
            },
            {
                mutation: makeMutation('Mutation B'),
                status: 'no_counterexample',
                confidence: 0.95,
                searchTime: 20,
                modelClass: 'random',
                testsRun: 500,
            },
            {
                mutation: makeMutation('Mutation C'),
                status: 'timeout',
                confidence: 0.3,
                searchTime: 5000,
                modelClass: 'unevaluable',
                testsRun: 0,
            },
        ];
        const report: PathologyReport = {
            theoremName: 'mixed',
            results,
            overallConfidence: 0.33,
            timestamp: Date.now(),
            summary: 'Mixed results.',
        };

        const text = formatReport(report);

        expect(text).toContain('Mutations Tested: 3');
        expect(text).toContain('✗ [CE FOUND]');
        expect(text).toContain('✓ [SAFE]');
        expect(text).toContain('? [TIMEOUT]');
    });

    it('formats an empty report', () => {
        const report: PathologyReport = {
            theoremName: 'empty',
            results: [],
            overallConfidence: 1.0,
            timestamp: Date.now(),
            summary: 'Nothing to test.',
        };

        const text = formatReport(report);

        expect(text).toContain('Mutations Tested: 0');
        expect(text).toContain('Nothing to test.');
    });
});

// ── runCounterexampleEngine (integration) ────────────────────

describe('runCounterexampleEngine', () => {
    it('produces a PathologyReport for a simple theorem', async () => {
        const theorem: Theorem = {
            tag: 'Theorem',
            name: 'nat_nonneg',
            params: [{ name: 'n', type: Types.Nat, implicit: false }],
            statement: mk.binOp('≥', mk.var('n'), mk.nat(0)),
            proof: [{ tag: 'Omega' }],
            axiomBundle: BUNDLES.ClassicalMath!,
            metadata: { confidence: 1.0, dependencies: [] },
        };

        const report = await runCounterexampleEngine(theorem);

        expect(report.theoremName).toBe('nat_nonneg');
        expect(report.results).toBeInstanceOf(Array);
        expect(report.overallConfidence).toBeGreaterThanOrEqual(0);
        expect(report.overallConfidence).toBeLessThanOrEqual(1);
        expect(report.timestamp).toBeGreaterThan(0);
        expect(report.summary).toContain('nat_nonneg');
    });

    it('handles theorem with Prime param (drop_hypothesis path)', async () => {
        const theorem: Theorem = {
            tag: 'Theorem',
            name: 'prime_test',
            params: [
                { name: 'p', type: mk.app(mk.var('Prime'), mk.var('p')), implicit: false },
            ],
            statement: mk.binOp('≥', mk.var('p'), mk.nat(2)),
            proof: [{ tag: 'Omega' }],
            axiomBundle: BUNDLES.ClassicalMath!,
            metadata: { confidence: 1.0, dependencies: [] },
        };

        const report = await runCounterexampleEngine(theorem);

        expect(report.theoremName).toBe('prime_test');
        expect(report.results.length).toBeGreaterThan(0);
        for (const r of report.results) {
            expect(['counterexample_found', 'no_counterexample', 'timeout']).toContain(r.status);
        }
    });

    it('summary includes counterexample info when mutations fail', async () => {
        const theorem: Theorem = {
            tag: 'Theorem',
            name: 'even_thm',
            params: [
                { name: 'n', type: mk.app(mk.var('Even'), mk.var('n')), implicit: false },
            ],
            statement: mk.binOp('=', mk.binOp('mod', mk.var('n'), mk.nat(2)), mk.nat(0)),
            proof: [{ tag: 'Omega' }],
            axiomBundle: BUNDLES.ClassicalMath!,
            metadata: { confidence: 1.0, dependencies: [] },
        };

        const report = await runCounterexampleEngine(theorem);
        const ceCount = report.results.filter(r => r.status === 'counterexample_found').length;

        if (ceCount > 0) {
            expect(report.summary).toContain('counterexample');
            expect(report.summary).toContain('hypotheses appear necessary');
        } else {
            expect(report.summary).toContain('No counterexamples found');
            expect(report.summary).toContain('robust');
        }
    });

    it('handles theorem with Coprime params', async () => {
        const theorem: Theorem = {
            tag: 'Theorem',
            name: 'coprime_thm',
            params: [
                { name: 'h', type: mk.app(mk.app(mk.var('Coprime'), mk.var('a')), mk.var('b')), implicit: false },
            ],
            statement: mk.binOp('≥', mk.binOp('+', mk.var('a'), mk.var('b')), mk.nat(2)),
            proof: [{ tag: 'Omega' }],
            axiomBundle: BUNDLES.ClassicalMath!,
            metadata: { confidence: 1.0, dependencies: [] },
        };

        const report = await runCounterexampleEngine(theorem);
        expect(report.theoremName).toBe('coprime_thm');
        expect(report.results.length).toBeGreaterThan(0);
    });

    it('handles theorem with Odd param', async () => {
        const theorem: Theorem = {
            tag: 'Theorem',
            name: 'odd_thm',
            params: [
                { name: 'n', type: mk.app(mk.var('Odd'), mk.var('n')), implicit: false },
            ],
            statement: mk.binOp('≥', mk.var('n'), mk.nat(1)),
            proof: [{ tag: 'Omega' }],
            axiomBundle: BUNDLES.ClassicalMath!,
            metadata: { confidence: 1.0, dependencies: [] },
        };

        const report = await runCounterexampleEngine(theorem);
        expect(report.theoremName).toBe('odd_thm');
    });
});
