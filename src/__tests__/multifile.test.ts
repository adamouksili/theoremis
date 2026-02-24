// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Multi-file Support Tests
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { InMemoryFileProvider, resolveMultiFile, splitIntoSections } from '../parser/multifile';

describe('InMemoryFileProvider', () => {
    it('returns content for known files', async () => {
        const provider = new InMemoryFileProvider();
        provider.add('main.tex', 'Hello');
        expect(await provider.readFile('main.tex')).toBe('Hello');
    });

    it('returns null for unknown files', async () => {
        const provider = new InMemoryFileProvider();
        expect(await provider.readFile('missing.tex')).toBeNull();
    });
});

describe('resolveMultiFile', () => {
    it('resolves \\input directives', async () => {
        const provider = new InMemoryFileProvider();
        provider.add('chapter1.tex', '\\begin{theorem} $x > 0$ \\end{theorem}');

        const result = await resolveMultiFile(
            '\\input{chapter1}',
            provider,
        );

        expect(result.source).toContain('\\begin{theorem}');
        expect(result.errors).toHaveLength(0);
        expect(result.files.has('chapter1.tex')).toBe(true);
    });

    it('resolves \\include directives', async () => {
        const provider = new InMemoryFileProvider();
        provider.add('section.tex', 'Some content');

        const result = await resolveMultiFile(
            '\\include{section}',
            provider,
        );

        expect(result.source).toContain('Some content');
        expect(result.errors).toHaveLength(0);
    });

    it('adds .tex extension when missing', async () => {
        const provider = new InMemoryFileProvider();
        provider.add('intro.tex', 'Introduction');

        const result = await resolveMultiFile('\\input{intro}', provider);
        expect(result.source).toContain('Introduction');
    });

    it('reports error for missing files', async () => {
        const provider = new InMemoryFileProvider();
        const result = await resolveMultiFile('\\input{missing}', provider);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('File not found');
    });

    it('detects circular includes', async () => {
        const provider = new InMemoryFileProvider();
        provider.add('a.tex', '\\input{b}');
        provider.add('b.tex', '\\input{a}');

        const result = await resolveMultiFile('\\input{a}', provider);
        expect(result.errors.some(e => e.includes('Circular'))).toBe(true);
    });

    it('handles nested includes', async () => {
        const provider = new InMemoryFileProvider();
        provider.add('outer.tex', 'before \\input{inner} after');
        provider.add('inner.tex', 'NESTED');

        const result = await resolveMultiFile('\\input{outer}', provider);
        expect(result.source).toContain('NESTED');
        expect(result.files.has('outer.tex')).toBe(true);
        expect(result.files.has('inner.tex')).toBe(true);
    });

    it('respects maximum depth', async () => {
        const provider = new InMemoryFileProvider();
        // Create a deep chain
        for (let i = 0; i < 15; i++) {
            provider.add(`f${i}.tex`, `\\input{f${i + 1}}`);
        }
        provider.add('f15.tex', 'leaf');

        const result = await resolveMultiFile('\\input{f0}', provider);
        expect(result.errors.some(e => e.includes('depth'))).toBe(true);
    });

    it('handles source with no includes', async () => {
        const provider = new InMemoryFileProvider();
        const result = await resolveMultiFile('No includes here', provider);
        expect(result.source).toBe('No includes here');
        expect(result.errors).toHaveLength(0);
        expect(result.files.size).toBe(0);
    });
});

describe('splitIntoSections', () => {
    it('splits document by section commands', () => {
        const source = `Preamble text
\\section{Introduction}
Intro text
\\section{Methods}
Methods text`;
        const sections = splitIntoSections(source);
        expect(sections.length).toBeGreaterThanOrEqual(2);
        expect(sections.some(s => s.title === 'Introduction')).toBe(true);
        expect(sections.some(s => s.title === 'Methods')).toBe(true);
    });

    it('handles subsections', () => {
        const source = `\\section{Main}
Content
\\subsection{Sub}
Sub content`;
        const sections = splitIntoSections(source);
        const sub = sections.find(s => s.title === 'Sub');
        expect(sub).toBeDefined();
        expect(sub!.level).toBe(3);
    });

    it('handles document with no sections', () => {
        const source = 'Just plain text';
        const sections = splitIntoSections(source);
        expect(sections).toHaveLength(1);
        expect(sections[0].title).toBe('Preamble');
    });

    it('preserves section content', () => {
        const source = `\\section{Algebra}
Group theory content here
More content`;
        const sections = splitIntoSections(source);
        const algebra = sections.find(s => s.title === 'Algebra');
        expect(algebra).toBeDefined();
        expect(algebra!.content).toContain('Group theory content');
    });
});
