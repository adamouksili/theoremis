import { describe, it, expect } from 'vitest';
import { exportAnnotatedLaTeX } from '../emitters/annotated-latex';
import { mk, Types, BUNDLES, type IRModule, type Theorem, type Definition, type Lemma } from '../core/ir';
import type { TypeCheckResult } from '../core/typechecker';
import type { EmitterResult } from '../emitters/lean4';
import type { PathologyReport } from '../engine/counterexample';

function makeModule(declarations: IRModule['declarations']): IRModule {
    return { name: 'test', declarations, axiomBundle: BUNDLES.ClassicalMath!, imports: [] };
}

function makeTC(overrides: Partial<TypeCheckResult> = {}): TypeCheckResult {
    return {
        valid: true,
        mode: 'permissive',
        diagnostics: [],
        inferredTypes: new Map(),
        holes: [],
        axiomUsage: new Set(),
        ...overrides,
    };
}

const simpleThm: Theorem = {
    tag: 'Theorem',
    name: 'pythagorean',
    params: [{ name: 'n', type: Types.Nat, implicit: false }],
    statement: mk.binOp('≥', mk.var('n'), mk.nat(0)),
    proof: [{ tag: 'Omega' }],
    axiomBundle: BUNDLES.ClassicalMath!,
    metadata: { confidence: 1.0, dependencies: [] },
};

const simpleDef: Definition = {
    tag: 'Definition',
    name: 'double',
    params: [{ name: 'n', type: Types.Nat, implicit: false }],
    returnType: Types.Nat,
    body: mk.binOp('*', mk.nat(2), mk.var('n')),
};

const simpleLemma: Lemma = {
    tag: 'Lemma',
    name: 'helper_lem',
    params: [],
    statement: mk.binOp('=', mk.nat(1), mk.nat(1)),
    proof: [{ tag: 'Ring' }],
};

describe('exportAnnotatedLaTeX', () => {
    it('generates preamble with module metadata', () => {
        const ir = makeModule([simpleThm]);
        const tc = makeTC();
        const result = exportAnnotatedLaTeX('', ir, tc);

        expect(result).toContain('% Annotated by Theoremis');
        expect(result).toContain('% Declarations: 1');
        expect(result).toContain('% Axiom bundle: ClassicalMath');
        expect(result).toContain('% Type-check: PASSED (0 diagnostics)');
    });

    it('includes colorize packages by default', () => {
        const ir = makeModule([]);
        const tc = makeTC();
        const result = exportAnnotatedLaTeX('', ir, tc);

        expect(result).toContain('\\usepackage{xcolor}');
        expect(result).toContain('\\usepackage{hyperref}');
        expect(result).toContain('\\definecolor{svgreen}');
        expect(result).toContain('\\newcommand{\\svstatus}');
    });

    it('omits color packages when colorize is false', () => {
        const ir = makeModule([]);
        const tc = makeTC();
        const result = exportAnnotatedLaTeX('', ir, tc, null, null, { colorize: false });

        expect(result).not.toContain('\\usepackage{xcolor}');
        expect(result).not.toContain('\\definecolor{svgreen}');
    });

    it('annotates \\begin{theorem} with verified status', () => {
        const ir = makeModule([simpleThm]);
        const tc = makeTC();
        const source = '\\begin{theorem}[pythagorean]\nFor all n, n >= 0.\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc);

        expect(result).toContain('% ── Theoremis: Theorem "pythagorean" — verified ──');
        expect(result).toContain('\\svstatus{svgreen}{✓ verified}');
    });

    it('annotates \\begin{definition} environments', () => {
        const ir = makeModule([simpleDef]);
        const tc = makeTC();
        const source = '\\begin{definition}[double]\nLet double(n) = 2n.\n\\end{definition}';
        const result = exportAnnotatedLaTeX(source, ir, tc);

        expect(result).toContain('% ── Theoremis: Definition "double" — verified ──');
    });

    it('handles abbreviated environment names: thm, defn, lem', () => {
        const ir = makeModule([simpleThm, simpleDef, simpleLemma]);
        const tc = makeTC();

        const thmSource = '\\begin{thm}[pythagorean]\nBody\n\\end{thm}';
        const thmResult = exportAnnotatedLaTeX(thmSource, ir, tc);
        expect(thmResult).toContain('Theorem "pythagorean"');

        const defnSource = '\\begin{defn}[double]\nBody\n\\end{defn}';
        const defnResult = exportAnnotatedLaTeX(defnSource, ir, tc);
        expect(defnResult).toContain('Definition "double"');

        const lemSource = '\\begin{lem}[helper_lem]\nBody\n\\end{lem}';
        const lemResult = exportAnnotatedLaTeX(lemSource, ir, tc);
        expect(lemResult).toContain('Lemma "helper_lem"');
    });

    it('matches declarations by kind when no name is given', () => {
        const ir = makeModule([simpleThm]);
        const tc = makeTC();
        const source = '\\begin{theorem}\nSome theorem.\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc);

        expect(result).toContain('Theorem "pythagorean"');
    });

    it('matches declarations via partial name inclusion', () => {
        const ir = makeModule([simpleThm]);
        const tc = makeTC();
        const source = '\\begin{theorem}[pythag]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc);

        expect(result).toContain('Theorem "pythagorean"');
    });

    it('reports partial status for theorems with sorry', () => {
        const sorryThm: Theorem = {
            ...simpleThm,
            name: 'sorry_thm',
            proof: [{ tag: 'Sorry' }],
        };
        const ir = makeModule([sorryThm]);
        const tc = makeTC();
        const source = '\\begin{theorem}[sorry_thm]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc);

        expect(result).toContain('partial');
        expect(result).toContain('svyellow');
    });

    it('reports partial status for sorry nested in Seq', () => {
        const seqSorryThm: Theorem = {
            ...simpleThm,
            name: 'seq_sorry',
            proof: [{ tag: 'Seq', tactics: [{ tag: 'Intro', names: ['h'] }, { tag: 'Sorry' }] }],
        };
        const ir = makeModule([seqSorryThm]);
        const tc = makeTC();
        const source = '\\begin{theorem}[seq_sorry]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc);

        expect(result).toContain('partial');
    });

    it('reports verified when Alt has at least one non-sorry branch', () => {
        const altThm: Theorem = {
            ...simpleThm,
            name: 'alt_thm',
            proof: [{ tag: 'Alt', tactics: [{ tag: 'Omega' }, { tag: 'Sorry' }] }],
        };
        const ir = makeModule([altThm]);
        const tc = makeTC();
        const source = '\\begin{theorem}[alt_thm]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc);

        expect(result).toContain('verified');
    });

    it('reports partial when ALL Alt branches are sorry', () => {
        const altSorryThm: Theorem = {
            ...simpleThm,
            name: 'alt_sorry',
            proof: [{ tag: 'Alt', tactics: [{ tag: 'Sorry' }, { tag: 'Sorry' }] }],
        };
        const ir = makeModule([altSorryThm]);
        const tc = makeTC();
        const source = '\\begin{theorem}[alt_sorry]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc);

        expect(result).toContain('partial');
    });

    it('reports unverified when diagnostics have errors', () => {
        const ir = makeModule([simpleThm]);
        const tc = makeTC({
            valid: false,
            diagnostics: [{ severity: 'error', message: 'type mismatch', location: 'pythagorean' }],
        });
        const source = '\\begin{theorem}[pythagorean]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc);

        expect(result).toContain('unverified');
        expect(result).toContain('svred');
        expect(result).toContain('✗');
    });

    it('reports partial when diagnostics have warnings', () => {
        const ir = makeModule([simpleThm]);
        const tc = makeTC({
            diagnostics: [{ severity: 'warning', message: 'possible issue', location: 'pythagorean' }],
        });
        const source = '\\begin{theorem}[pythagorean]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc);

        expect(result).toContain('partial');
    });

    it('handles empty source with no declarations', () => {
        const ir = makeModule([]);
        const tc = makeTC();
        const result = exportAnnotatedLaTeX('', ir, tc);

        expect(result).toContain('% Declarations: 0');
        expect(result).toContain('% Theoremis Formal Verification Summary');
    });

    it('passes through non-environment lines unchanged', () => {
        const ir = makeModule([]);
        const tc = makeTC();
        const source = 'This is plain text.\nAnother line.\n\\section{Intro}';
        const result = exportAnnotatedLaTeX(source, ir, tc);

        expect(result).toContain('This is plain text.');
        expect(result).toContain('Another line.');
        expect(result).toContain('\\section{Intro}');
    });

    it('omits status annotation when includeStatus is false', () => {
        const ir = makeModule([simpleThm]);
        const tc = makeTC();
        const source = '\\begin{theorem}[pythagorean]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc, null, null, { includeStatus: false });

        expect(result).not.toContain('% ── Theoremis: Theorem');
        expect(result).toContain('\\begin{theorem}[pythagorean]');
    });

    it('includes Lean 4 cross-reference when lean4 result is provided', () => {
        const ir = makeModule([simpleThm]);
        const tc = makeTC();
        const lean4: EmitterResult = { code: '', language: 'lean4', fileExtension: '.lean', warnings: [], valid: true };
        const source = '\\begin{theorem}[pythagorean]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc, lean4);

        expect(result).toContain('% Lean 4: see output.lean for formal statement');
    });

    it('omits Lean 4 link when includeLeanLinks is false', () => {
        const ir = makeModule([simpleThm]);
        const tc = makeTC();
        const lean4: EmitterResult = { code: '', language: 'lean4', fileExtension: '.lean', warnings: [], valid: true };
        const source = '\\begin{theorem}[pythagorean]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc, lean4, null, { includeLeanLinks: false });

        expect(result).not.toContain('% Lean 4:');
    });

    it('annotates counterexamples found', () => {
        const ir = makeModule([simpleThm]);
        const tc = makeTC();
        const report: PathologyReport = {
            theoremName: 'pythagorean',
            results: [
                {
                    mutation: { type: 'drop_hypothesis', description: 'drop h', original: mk.nat(1), mutated: mk.nat(1), params: [] },
                    status: 'counterexample_found',
                    confidence: 0.9,
                    searchTime: 10,
                    modelClass: 'random',
                    testsRun: 100,
                },
            ],
            overallConfidence: 0.8,
            timestamp: Date.now(),
            summary: 'test',
        };
        const source = '\\begin{theorem}[pythagorean]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc, null, report);

        expect(result).toContain('⚠ 1 mutation(s) found counterexamples (confidence: 80%)');
    });

    it('annotates no counterexamples found', () => {
        const ir = makeModule([simpleThm]);
        const tc = makeTC();
        const report: PathologyReport = {
            theoremName: 'pythagorean',
            results: [
                {
                    mutation: { type: 'drop_hypothesis', description: 'drop h', original: mk.nat(1), mutated: mk.nat(1), params: [] },
                    status: 'no_counterexample',
                    confidence: 0.95,
                    searchTime: 10,
                    modelClass: 'random',
                    testsRun: 500,
                },
            ],
            overallConfidence: 0.95,
            timestamp: Date.now(),
            summary: 'test',
        };
        const source = '\\begin{theorem}[pythagorean]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc, null, report);

        expect(result).toContain('✓ No counterexamples found (confidence: 95%)');
    });

    it('omits counterexample annotation when includeCounterexamples is false', () => {
        const ir = makeModule([simpleThm]);
        const tc = makeTC();
        const report: PathologyReport = {
            theoremName: 'pythagorean',
            results: [],
            overallConfidence: 1.0,
            timestamp: Date.now(),
            summary: 'test',
        };
        const source = '\\begin{theorem}[pythagorean]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc, null, report, { includeCounterexamples: false });

        expect(result).not.toContain('counterexamples');
    });

    it('generates verification summary for all declarations', () => {
        const ir = makeModule([simpleThm, simpleDef]);
        const tc = makeTC({
            diagnostics: [
                { severity: 'info', message: 'ok', location: 'pythagorean' },
                { severity: 'warning', message: 'type hint', location: 'double' },
            ],
        });
        const result = exportAnnotatedLaTeX('', ir, tc);

        expect(result).toContain('% Theorem pythagorean: verified');
        expect(result).toContain('% Definition double: partial');
        expect(result).toContain('%   [warning] type hint');
    });

    it('shows FAILED when type-check is invalid', () => {
        const ir = makeModule([]);
        const tc = makeTC({
            valid: false,
            diagnostics: [{ severity: 'error', message: 'bad' }],
        });
        const result = exportAnnotatedLaTeX('', ir, tc);

        expect(result).toContain('% Type-check: FAILED (1 diagnostics)');
    });

    it('includes axiom usage in summary', () => {
        const ir = makeModule([]);
        const tc = makeTC({ axiomUsage: new Set(['LEM', 'Choice']) });
        const result = exportAnnotatedLaTeX('', ir, tc);

        expect(result).toContain('% Axioms used: LEM, Choice');
    });

    it('handles multi-line LaTeX with multiple environments', () => {
        const thm2: Theorem = { ...simpleThm, name: 'second_thm' };
        const ir = makeModule([simpleThm, thm2]);
        const tc = makeTC();
        const source = [
            '\\documentclass{article}',
            '\\begin{document}',
            '\\begin{theorem}[pythagorean]',
            'First theorem body.',
            '\\end{theorem}',
            '',
            'Some text between.',
            '',
            '\\begin{theorem}[second_thm]',
            'Second theorem body.',
            '\\end{theorem}',
            '\\end{document}',
        ].join('\n');
        const result = exportAnnotatedLaTeX(source, ir, tc);

        expect(result).toContain('Theorem "pythagorean" — verified');
        expect(result).toContain('Theorem "second_thm" — verified');
        expect(result).toContain('\\documentclass{article}');
        expect(result).toContain('Some text between.');
    });

    it('does not annotate unmatched environments', () => {
        const ir = makeModule([simpleThm]);
        const tc = makeTC();
        const source = '\\begin{theorem}[nonexistent_name]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc);

        expect(result).not.toContain('% ── Theoremis: Theorem "nonexistent_name"');
    });

    it('skips colorize status when colorize is false but includeStatus is true', () => {
        const ir = makeModule([simpleThm]);
        const tc = makeTC();
        const source = '\\begin{theorem}[pythagorean]\nBody\n\\end{theorem}';
        const result = exportAnnotatedLaTeX(source, ir, tc, null, null, { colorize: false });

        expect(result).toContain('% ── Theoremis: Theorem "pythagorean" — verified ──');
        expect(result).not.toContain('\\svstatus');
        expect(result).toContain('\\begin{theorem}[pythagorean]');
    });
});
