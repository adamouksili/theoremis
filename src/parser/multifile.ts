// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Multi-file LaTeX Document Support
// Resolves \input{} and \include{} directives to build a
// unified document from multiple .tex files
// ─────────────────────────────────────────────────────────────

export interface ResolvedDocument {
    source: string;
    files: Map<string, string>;
    errors: string[];
}

export interface FileProvider {
    readFile(path: string): Promise<string | null>;
}

// ── In-memory file provider ─────────────────────────────────

export class InMemoryFileProvider implements FileProvider {
    private files = new Map<string, string>();

    add(path: string, content: string) {
        this.files.set(path, content);
    }

    async readFile(path: string): Promise<string | null> {
        return this.files.get(path) ?? null;
    }
}

// ── Resolve \input and \include ─────────────────────────────

const INPUT_REGEX = /\\(?:input|include|subfile)\s*\{([^}]+)\}/g;

export async function resolveMultiFile(
    mainSource: string,
    provider: FileProvider,
    depth = 0,
    visited = new Set<string>()
): Promise<ResolvedDocument> {
    const files = new Map<string, string>();
    const errors: string[] = [];

    if (depth > 10) {
        return { source: mainSource, files, errors: ['Maximum include depth (10) exceeded'] };
    }

    let resolved = mainSource;
    const matches = [...mainSource.matchAll(INPUT_REGEX)];

    for (const match of matches) {
        let path = match[1].trim();
        // Add .tex extension if missing
        if (!path.endsWith('.tex')) path += '.tex';

        if (visited.has(path)) {
            errors.push(`Circular include: ${path}`);
            resolved = resolved.replace(match[0], `% [ERROR: Circular include: ${path}]`);
            continue;
        }

        visited.add(path);
        const content = await provider.readFile(path);

        if (content === null) {
            errors.push(`File not found: ${path}`);
            resolved = resolved.replace(match[0], `% [ERROR: File not found: ${path}]`);
            continue;
        }

        files.set(path, content);

        // Recursively resolve nested includes
        const nested = await resolveMultiFile(content, provider, depth + 1, visited);
        for (const [k, v] of nested.files) files.set(k, v);
        errors.push(...nested.errors);

        resolved = resolved.replace(match[0], nested.source);
    }

    return { source: resolved, files, errors };
}

// ── Split document into sections ────────────────────────────

export interface DocumentSection {
    title: string;
    level: number;
    content: string;
    startLine: number;
}

export function splitIntoSections(source: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const lines = source.split('\n');

    const sectionCommands: Record<string, number> = {
        '\\chapter': 1,
        '\\section': 2,
        '\\subsection': 3,
        '\\subsubsection': 4,
    };

    let currentTitle = 'Preamble';
    let currentLevel = 0;
    let currentContent: string[] = [];
    let currentStart = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let matched = false;

        for (const [cmd, level] of Object.entries(sectionCommands)) {
            if (line.trimStart().startsWith(cmd)) {
                // Save current section
                if (currentContent.length > 0 || currentTitle !== 'Preamble') {
                    sections.push({
                        title: currentTitle,
                        level: currentLevel,
                        content: currentContent.join('\n'),
                        startLine: currentStart,
                    });
                }

                // Extract title
                const titleMatch = line.match(/\{([^}]*)\}/);
                currentTitle = titleMatch ? titleMatch[1] : 'Untitled';
                currentLevel = level;
                currentContent = [];
                currentStart = i;
                matched = true;
                break;
            }
        }

        if (!matched) {
            currentContent.push(line);
        }
    }

    // Push final section
    if (currentContent.length > 0) {
        sections.push({
            title: currentTitle,
            level: currentLevel,
            content: currentContent.join('\n'),
            startLine: currentStart,
        });
    }

    return sections;
}
