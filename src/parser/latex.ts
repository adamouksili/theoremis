// ─────────────────────────────────────────────────────────────
// Theoremis  ·  LaTeX → Math-AST Parser
// Proper recursive descent with tokenizer and operator precedence
// ─────────────────────────────────────────────────────────────

import type { Term, Tactic, Param, Declaration, Theorem, Definition, Lemma, IRModule, AxiomBundle } from '../core/ir';
import { mk, Types, BUNDLES } from '../core/ir';
import type { MathDocument, MathNode, ThmNode, DefNode, LemmaNode, ProofNode, HypothesisDecl, DependencyEdge } from './ast';

// ── Token types ─────────────────────────────────────────────

type TokenType =
    | 'NUMBER' | 'IDENT' | 'COMMAND' | 'LBRACE' | 'RBRACE'
    | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET'
    | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'CARET' | 'UNDERSCORE'
    | 'EQUALS' | 'LT' | 'GT' | 'COMMA' | 'PIPE'
    | 'EOF' | 'WHITESPACE' | 'AMPERSAND' | 'BACKSLASH';

interface Token {
    type: TokenType;
    value: string;
    pos: number;
}

// ── Tokenizer ───────────────────────────────────────────────

function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < input.length) {
        const ch = input[i];

        // Skip whitespace (but don't skip newlines relevant to alignment)
        if (/\s/.test(ch)) {
            i++;
            continue;
        }

        // Numbers
        if (/\d/.test(ch)) {
            let num = '';
            while (i < input.length && /\d/.test(input[i])) { num += input[i]; i++; }
            // Check for decimal
            if (i < input.length && input[i] === '.' && i + 1 < input.length && /\d/.test(input[i + 1])) {
                num += '.'; i++;
                while (i < input.length && /\d/.test(input[i])) { num += input[i]; i++; }
            }
            tokens.push({ type: 'NUMBER', value: num, pos: i - num.length });
            continue;
        }

        // LaTeX commands
        if (ch === '\\') {
            let cmd = '\\';
            i++;
            if (i < input.length && /[a-zA-Z]/.test(input[i])) {
                while (i < input.length && /[a-zA-Z]/.test(input[i])) { cmd += input[i]; i++; }
            } else if (i < input.length) {
                // Single-char command like \{ \}
                cmd += input[i]; i++;
            }
            tokens.push({ type: 'COMMAND', value: cmd, pos: i - cmd.length });
            continue;
        }

        // Identifiers (including Greek letters)
        if (/[a-zA-Zα-ωΑ-Ω_ℕℤℝℂ]/.test(ch)) {
            let ident = '';
            while (i < input.length && /[a-zA-Zα-ωΑ-Ω_ℕℤℝℂ0-9']/.test(input[i])) { ident += input[i]; i++; }
            tokens.push({ type: 'IDENT', value: ident, pos: i - ident.length });
            continue;
        }

        // Single characters
        const singleChars: Record<string, TokenType> = {
            '{': 'LBRACE', '}': 'RBRACE', '(': 'LPAREN', ')': 'RPAREN',
            '[': 'LBRACKET', ']': 'RBRACKET', '+': 'PLUS', '-': 'MINUS',
            '*': 'STAR', '/': 'SLASH', '^': 'CARET', '_': 'UNDERSCORE',
            '=': 'EQUALS', '<': 'LT', '>': 'GT', ',': 'COMMA', '|': 'PIPE',
            '&': 'AMPERSAND',
        };

        if (singleChars[ch]) {
            tokens.push({ type: singleChars[ch], value: ch, pos: i });
            i++;
            continue;
        }

        // Unicode operators
        if ('≤≥≡∀∃∈∉⊆∧∨¬→↔'.includes(ch)) {
            tokens.push({ type: 'IDENT', value: ch, pos: i });
            i++;
            continue;
        }

        // Skip unknown
        i++;
    }

    tokens.push({ type: 'EOF', value: '', pos: i });
    return tokens;
}

// ── Parser state ────────────────────────────────────────────

class ExprParser {
    private tokens: Token[];
    private pos: number;
    private errors: string[] = [];

    constructor(tokens: Token[]) {
        this.tokens = tokens;
        this.pos = 0;
    }

    getErrors(): string[] { return this.errors; }

    private peek(): Token {
        return this.tokens[this.pos] || { type: 'EOF', value: '', pos: -1 };
    }

    private advance(): Token {
        const tok = this.tokens[this.pos];
        this.pos++;
        return tok;
    }

    private expect(type: TokenType): Token {
        const tok = this.peek();
        if (tok.type !== type) {
            // Recovery: record error, advance past the bad token to prevent infinite loops
            this.errors.push(`Expected ${type} but got ${tok.type} ('${tok.value}') at pos ${tok.pos}`);
            if (tok.type !== 'EOF') this.advance();
            return tok;
        }
        return this.advance();
    }

    private match(type: TokenType, value?: string): boolean {
        const tok = this.peek();
        if (tok.type === type && (!value || tok.value === value)) {
            this.advance();
            return true;
        }
        return false;
    }

    private isAtEnd(): boolean {
        return this.peek().type === 'EOF';
    }

    // ── Precedence climbing ───────────────────────────────

    parse(): Term {
        const result = this.parseQuantifier();
        return result;
    }

    // Quantifiers (lowest precedence): ∀, ∃
    private parseQuantifier(): Term {
        const tok = this.peek();

        if (tok.type === 'COMMAND' && (tok.value === '\\forall' || tok.value === '\\exists')) {
            this.advance();
            const isForall = tok.value === '\\forall';
            const param = this.parseIdent();

            let domain: Term = Types.Type0;
            if (this.match('COMMAND', '\\in') || this.matchUnicode('∈')) {
                domain = this.parseDomainExpr();
            }

            this.match('COMMA');
            const body = this.parseQuantifier();

            return isForall ? mk.forAll(param, domain, body) : mk.exists(param, domain, body);
        }

        // Unicode quantifiers
        if (tok.type === 'IDENT' && (tok.value === '∀' || tok.value === '∃')) {
            this.advance();
            const isForall = tok.value === '∀';
            const param = this.parseIdent();

            let domain: Term = Types.Type0;
            if (this.match('COMMAND', '\\in') || this.matchUnicode('∈')) {
                domain = this.parseDomainExpr();
            }

            this.match('COMMA');
            const body = this.parseQuantifier();

            return isForall ? mk.forAll(param, domain, body) : mk.exists(param, domain, body);
        }

        return this.parseIff();
    }

    // Iff (↔)
    private parseIff(): Term {
        let left = this.parseImplication();

        while (this.matchCommand('\\iff') || this.matchCommand('\\Leftrightarrow') || this.matchUnicode('↔')) {
            const right = this.parseImplication();
            left = mk.binOp('↔', left, right);
        }

        return left;
    }

    // Implication (→)
    private parseImplication(): Term {
        let left = this.parseDisjunction();

        while (this.matchCommand('\\implies') || this.matchCommand('\\Rightarrow') || this.matchCommand('\\to') || this.matchUnicode('→')) {
            const right = this.parseDisjunction();
            left = mk.binOp('→', left, right);
        }

        return left;
    }

    // Disjunction (∨)
    private parseDisjunction(): Term {
        let left = this.parseConjunction();

        while (this.matchCommand('\\lor') || this.matchCommand('\\vee') || this.matchUnicode('∨')) {
            const right = this.parseConjunction();
            left = mk.binOp('∨', left, right);
        }

        return left;
    }

    // Conjunction (∧)
    private parseConjunction(): Term {
        let left = this.parseEquivRel();

        while (this.matchCommand('\\land') || this.matchCommand('\\wedge') || this.matchUnicode('∧')) {
            const right = this.parseEquivRel();
            left = mk.binOp('∧', left, right);
        }

        return left;
    }

    // Equivalence / Congruence / Membership / Subset
    private parseEquivRel(): Term {
        let left = this.parseComparison();

        // Congruence: a ≡ b (mod m)
        if (this.matchCommand('\\equiv')) {
            const right = this.parseComparison();
            // Check for \pmod{m} or (\bmod m)
            let modulus: Term | undefined;
            if (this.matchCommand('\\pmod')) {
                this.expect('LBRACE');
                modulus = this.parseAddition();
                this.expect('RBRACE');
            } else if (this.peek().type === 'LPAREN') {
                const saved = this.pos;
                this.advance();
                if (this.matchCommand('\\bmod')) {
                    modulus = this.parseAddition();
                    this.expect('RPAREN');
                } else {
                    this.pos = saved;
                }
            }
            return mk.equiv(left, right, modulus);
        }

        // Element-of
        if (this.matchCommand('\\in') || this.matchUnicode('∈')) {
            const right = this.parseComparison();
            return mk.binOp('∈', left, right);
        }
        if (this.matchCommand('\\notin') || this.matchUnicode('∉')) {
            const right = this.parseComparison();
            return mk.binOp('∉', left, right);
        }

        // Subset
        if (this.matchCommand('\\subseteq') || this.matchCommand('\\subset') || this.matchUnicode('⊆')) {
            const right = this.parseComparison();
            return mk.binOp('⊆', left, right);
        }

        return left;
    }

    // Comparison (=, <, >, ≤, ≥)
    private parseComparison(): Term {
        let left = this.parseAddition();

        if (this.match('EQUALS')) {
            const right = this.parseAddition();
            return mk.binOp('=', left, right);
        }
        if (this.matchCommand('\\leq') || this.matchCommand('\\le') || this.matchUnicode('≤')) {
            const right = this.parseAddition();
            return mk.binOp('≤', left, right);
        }
        if (this.matchCommand('\\geq') || this.matchCommand('\\ge') || this.matchUnicode('≥')) {
            const right = this.parseAddition();
            return mk.binOp('≥', left, right);
        }
        if (this.match('LT')) {
            const right = this.parseAddition();
            return mk.binOp('<', left, right);
        }
        if (this.match('GT')) {
            const right = this.parseAddition();
            return mk.binOp('>', left, right);
        }

        return left;
    }

    // Addition / Subtraction
    private parseAddition(): Term {
        let left = this.parseMultiplication();

        while (true) {
            if (this.match('PLUS')) {
                const right = this.parseMultiplication();
                left = mk.binOp('+', left, right);
            } else if (this.match('MINUS')) {
                const right = this.parseMultiplication();
                left = mk.binOp('-', left, right);
            } else {
                break;
            }
        }

        return left;
    }

    // Multiplication (* · ×)
    private parseMultiplication(): Term {
        let left = this.parseUnary();

        while (true) {
            if (this.match('STAR') || this.matchCommand('\\cdot') || this.matchCommand('\\times')) {
                const right = this.parseUnary();
                left = mk.binOp('*', left, right);
            } else if (this.matchCommand('\\mod') || this.matchCommand('\\bmod')) {
                const right = this.parseUnary();
                left = mk.binOp('mod', left, right);
            } else {
                break;
            }
        }

        return left;
    }

    // Unary (¬, -)
    private parseUnary(): Term {
        if (this.matchCommand('\\neg') || this.matchCommand('\\lnot') || this.matchUnicode('¬')) {
            const operand = this.parseUnary();
            return mk.unaryOp('¬', operand);
        }

        if (this.match('MINUS')) {
            const operand = this.parsePower();
            return mk.unaryOp('-', operand);
        }

        return this.parsePower();
    }

    // Exponentiation (right-associative)
    private parsePower(): Term {
        let base = this.parseApp();

        if (this.match('CARET')) {
            let exp: Term;
            if (this.match('LBRACE')) {
                exp = this.parse(); // Full expression inside braces
                this.expect('RBRACE');
            } else {
                // Single token exponent
                exp = this.parseAtom();
            }
            return mk.binOp('^', base, exp);
        }

        return base;
    }

    // Function application (juxtaposition)
    private parseApp(): Term {
        let func = this.parseAtom();

        // Handle f(x) style application
        while (this.peek().type === 'LPAREN') {
            this.advance();
            const arg = this.parse();
            this.expect('RPAREN');
            func = mk.app(func, arg);
        }

        return func;
    }

    // Atoms
    private parseAtom(): Term {
        const tok = this.peek();

        // Numbers
        if (tok.type === 'NUMBER') {
            this.advance();
            if (tok.value.includes('.') || parseInt(tok.value, 10) < 0) {
                return mk.int(parseFloat(tok.value));
            }
            return mk.nat(parseInt(tok.value, 10));
        }

        // Identifiers and domain variables
        if (tok.type === 'IDENT') {
            this.advance();
            const domainMap: Record<string, Term> = {
                'N': Types.Nat, 'ℕ': Types.Nat, 'Nat': Types.Nat,
                'Z': Types.Int, 'ℤ': Types.Int, 'Int': Types.Int,
                'R': Types.Real, 'ℝ': Types.Real, 'Real': Types.Real,
                'C': Types.Complex, 'ℂ': Types.Complex, 'Complex': Types.Complex,
                'true': mk.bool(true), 'false': mk.bool(false),
            };
            return domainMap[tok.value] || mk.var(tok.value);
        }

        // LaTeX commands
        if (tok.type === 'COMMAND') {
            return this.parseCommand();
        }

        // Parenthesized expression
        if (tok.type === 'LPAREN') {
            this.advance();
            const inner = this.parse();
            this.expect('RPAREN');
            return inner;
        }

        // Braces
        if (tok.type === 'LBRACE') {
            this.advance();
            const inner = this.parse();
            this.expect('RBRACE');
            return inner;
        }

        // Dollar signs stripped during preprocessing, so shouldn't appear here
        // Fallback
        this.advance();
        return mk.hole(`parse_error_${tok.pos}`);
    }

    // LaTeX command handling
    private parseCommand(): Term {
        const cmd = this.advance();

        switch (cmd.value) {
            case '\\mathbb': {
                this.expect('LBRACE');
                const inner = this.advance();
                this.expect('RBRACE');
                const map: Record<string, Term> = {
                    'N': Types.Nat, 'Z': Types.Int, 'R': Types.Real, 'C': Types.Complex,
                };
                return map[inner.value] || mk.var(inner.value);
            }

            case '\\frac': {
                this.expect('LBRACE');
                const num = this.parse();
                this.expect('RBRACE');
                this.expect('LBRACE');
                const den = this.parse();
                this.expect('RBRACE');
                return mk.binOp('/', num, den);
            }

            case '\\sqrt': {
                if (this.peek().type === 'LBRACKET') {
                    this.advance(); // [
                    const n = this.parse();
                    this.expect('RBRACKET');
                    this.expect('LBRACE');
                    const radicand = this.parse();
                    this.expect('RBRACE');
                    return mk.binOp('^', radicand, mk.binOp('/', mk.nat(1), n));
                }
                this.expect('LBRACE');
                const radicand = this.parse();
                this.expect('RBRACE');
                return mk.app(mk.var('sqrt'), radicand);
            }

            case '\\sum':
            case '\\prod': {
                const fn = cmd.value === '\\sum' ? 'Sum' : 'Prod';
                // Parse subscript/superscript bounds
                let lower: Term | null = null;
                let upper: Term | null = null;

                if (this.match('UNDERSCORE')) {
                    if (this.match('LBRACE')) {
                        lower = this.parse();
                        this.expect('RBRACE');
                    } else {
                        lower = this.parseAtom();
                    }
                }
                if (this.match('CARET')) {
                    if (this.match('LBRACE')) {
                        upper = this.parse();
                        this.expect('RBRACE');
                    } else {
                        upper = this.parseAtom();
                    }
                }

                const body = this.parseMultiplication();
                let result: Term = mk.app(mk.var(fn), body);
                if (lower) result = mk.app(result, lower);
                if (upper) result = mk.app(result, upper);
                return result;
            }

            case '\\int': {
                // Parse optional bounds
                if (this.match('UNDERSCORE')) {
                    if (this.match('LBRACE')) { this.parse(); this.expect('RBRACE'); }
                    else { this.parseAtom(); }
                }
                if (this.match('CARET')) {
                    if (this.match('LBRACE')) { this.parse(); this.expect('RBRACE'); }
                    else { this.parseAtom(); }
                }
                const body = this.parseMultiplication();
                return mk.app(mk.var('Integral'), body);
            }

            case '\\lim': {
                if (this.match('UNDERSCORE')) {
                    if (this.match('LBRACE')) { this.parse(); this.expect('RBRACE'); }
                    else { this.parseAtom(); }
                }
                const body = this.parseMultiplication();
                return mk.app(mk.var('Limit'), body);
            }

            case '\\binom': {
                this.expect('LBRACE');
                const n = this.parse();
                this.expect('RBRACE');
                this.expect('LBRACE');
                const k = this.parse();
                this.expect('RBRACE');
                return mk.app(mk.app(mk.var('Binom'), n), k);
            }

            case '\\operatorname': {
                this.expect('LBRACE');
                let name = '';
                while (this.peek().type !== 'RBRACE' && !this.isAtEnd()) {
                    name += this.advance().value;
                }
                this.expect('RBRACE');
                // Check if followed by parenthesized argument
                if (this.peek().type === 'LPAREN') {
                    this.advance();
                    const arg = this.parse();
                    this.expect('RPAREN');
                    return mk.app(mk.var(name), arg);
                }
                return mk.var(name);
            }

            case '\\text':
            case '\\mathrm':
            case '\\mathit':
            case '\\mathsf':
            case '\\mathcal':
            case '\\mathfrak': {
                this.expect('LBRACE');
                let text = '';
                while (this.peek().type !== 'RBRACE' && !this.isAtEnd()) {
                    text += this.advance().value;
                }
                this.expect('RBRACE');
                return mk.var(text);
            }

            case '\\left':
                // Skip \left delimiter, parse inner, expect \right
                this.advance(); // The delimiter character (e.g., '(' or '|')
                return this.parse();

            case '\\right':
                this.advance(); // The delimiter
                return mk.hole('right_delim'); // Should not reach here normally

            case '\\emph':
            case '\\textit':
            case '\\textbf': {
                this.expect('LBRACE');
                let text = '';
                while (this.peek().type !== 'RBRACE' && !this.isAtEnd()) {
                    text += this.advance().value;
                }
                this.expect('RBRACE');
                return mk.var(text);
            }

            case '\\infty':
                return mk.var('∞');

            case '\\pi':
                return mk.var('π');

            case '\\alpha': return mk.var('α');
            case '\\beta': return mk.var('β');
            case '\\gamma': return mk.var('γ');
            case '\\delta': return mk.var('δ');
            case '\\epsilon': case '\\varepsilon': return mk.var('ε');
            case '\\zeta': return mk.var('ζ');
            case '\\eta': return mk.var('η');
            case '\\theta': case '\\vartheta': return mk.var('θ');
            case '\\lambda': return mk.var('λ');
            case '\\mu': return mk.var('μ');
            case '\\nu': return mk.var('ν');
            case '\\xi': return mk.var('ξ');
            case '\\rho': return mk.var('ρ');
            case '\\sigma': return mk.var('σ');
            case '\\tau': return mk.var('τ');
            case '\\phi': case '\\varphi': return mk.var('φ');
            case '\\chi': return mk.var('χ');
            case '\\psi': return mk.var('ψ');
            case '\\omega': return mk.var('ω');
            case '\\Gamma': return mk.var('Γ');
            case '\\Delta': return mk.var('Δ');
            case '\\Sigma': return mk.var('Σ');
            case '\\Omega': return mk.var('Ω');

            case '\\ldots':
            case '\\cdots':
            case '\\dots':
                return mk.var('…');

            default:
                // Unknown command: treat as variable
                return mk.var(cmd.value.slice(1) || 'unknown');
        }
    }

    // Helpers
    private parseIdent(): string {
        const tok = this.peek();
        if (tok.type === 'IDENT') {
            this.advance();
            return tok.value;
        }
        if (tok.type === 'COMMAND') {
            this.advance();
            return tok.value.slice(1);
        }
        this.advance();
        return '_';
    }

    private parseDomainExpr(): Term {
        // Parse a domain specifier (usually a type like ℕ, ℤ, etc.)
        return this.parseComparison();
    }

    private matchCommand(cmd: string): boolean {
        const tok = this.peek();
        if (tok.type === 'COMMAND' && tok.value === cmd) {
            this.advance();
            return true;
        }
        return false;
    }

    private matchUnicode(ch: string): boolean {
        const tok = this.peek();
        if (tok.type === 'IDENT' && tok.value === ch) {
            this.advance();
            return true;
        }
        return false;
    }
}

// ── Public expression parser ────────────────────────────────

export function parseExpr(latex: string): Term {
    const cleaned = latex.trim()
        .replace(/\$\$/g, '')
        .replace(/\$/g, '')
        .trim();

    if (!cleaned) return mk.hole('empty');

    const tokens = tokenize(cleaned);
    const parser = new ExprParser(tokens);
    return parser.parse();
}

// ── Main parser entry point ─────────────────────────────────

export function parseLatex(source: string): MathDocument {
    const nodes: MathNode[] = [];
    const dependencies: DependencyEdge[] = [];
    const lines = source.split('\n');

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        // Theorem environments
        const thmMatch = line.match(/\\begin\{(theorem|thm)\}(?:\[([^\]]*)\])?/);
        if (thmMatch) {
            const { node, endLine } = parseTheoremEnv(lines, i, 'ThmNode', thmMatch[2] || '');
            nodes.push(node);
            i = endLine + 1;
            continue;
        }

        // Lemma environments
        const lemmaMatch = line.match(/\\begin\{(lemma|lem)\}(?:\[([^\]]*)\])?/);
        if (lemmaMatch) {
            const { node, endLine } = parseTheoremEnv(lines, i, 'LemmaNode', lemmaMatch[2] || '');
            nodes.push(node);
            i = endLine + 1;
            continue;
        }

        // Definition environments
        const defMatch = line.match(/\\begin\{(definition|defn)\}(?:\[([^\]]*)\])?/);
        if (defMatch) {
            const { node, endLine } = parseDefinitionEnv(lines, i, defMatch[2] || '');
            nodes.push(node);
            i = endLine + 1;
            continue;
        }

        // Proof environments
        const proofMatch = line.match(/\\begin\{proof\}/);
        if (proofMatch) {
            const { node, endLine } = parseProofEnv(lines, i);
            // Attach to the last theorem/lemma
            const lastThm = [...nodes].reverse().find(n => n.tag === 'ThmNode' || n.tag === 'LemmaNode') as ThmNode | LemmaNode | undefined;
            if (lastThm) {
                lastThm.proof = node;
            }
            i = endLine + 1;
            continue;
        }

        i++;
    }

    // Build dependencies from references
    for (const node of nodes) {
        if (node.tag === 'ThmNode' || node.tag === 'LemmaNode') {
            const refs = extractReferences(node.rawLatex);
            for (const ref of refs) {
                dependencies.push({ from: node.name, to: ref, kind: 'uses' });
            }
        }
    }

    return {
        title: extractTitle(source),
        nodes,
        dependencies,
        rawSource: source,
    };
}

// ── Convert MathDocument → IRModule ─────────────────────────

export function documentToIR(doc: MathDocument, axiomBundle?: AxiomBundle): IRModule {
    const bundle = axiomBundle ?? BUNDLES.ClassicalMath;
    const declarations: Declaration[] = [];

    for (const node of doc.nodes) {
        switch (node.tag) {
            case 'ThmNode': {
                const thm: Theorem = {
                    tag: 'Theorem',
                    name: sanitizeName(node.name),
                    params: hypothesesToParams(node.hypotheses),
                    statement: node.conclusion,
                    proof: node.proof?.tactics ?? [{ tag: 'Sorry' }],
                    axiomBundle: bundle,
                    metadata: {
                        source: doc.title,
                        lineNumber: node.line,
                        confidence: 0.85,
                        dependencies: extractReferences(node.rawLatex),
                    },
                };
                declarations.push(thm);
                break;
            }
            case 'LemmaNode': {
                const lem: Lemma = {
                    tag: 'Lemma',
                    name: sanitizeName(node.name),
                    params: hypothesesToParams(node.hypotheses),
                    statement: node.conclusion,
                    proof: node.proof?.tactics ?? [{ tag: 'Sorry' }],
                };
                declarations.push(lem);
                break;
            }
            case 'DefNode': {
                const def: Definition = {
                    tag: 'Definition',
                    name: sanitizeName(node.name),
                    params: node.params.map(p => ({
                        name: p.name,
                        type: p.type,
                        implicit: false,
                    })),
                    returnType: Types.Type0,
                    body: node.body ?? mk.hole('def_body'),
                };
                declarations.push(def);
                break;
            }
        }
    }

    return {
        name: sanitizeName(doc.title),
        declarations,
        axiomBundle: bundle,
        imports: [],
    };
}

// ── Environment parsers ─────────────────────────────────────

function parseTheoremEnv(
    lines: string[], start: number, tag: 'ThmNode' | 'LemmaNode', label: string
): { node: ThmNode | LemmaNode; endLine: number } {
    const endTag = tag === 'ThmNode' ? /\\end\{(theorem|thm)\}/ : /\\end\{(lemma|lem)\}/;
    let endLine = start + 1;
    const contentLines: string[] = [];

    while (endLine < lines.length && !endTag.test(lines[endLine])) {
        contentLines.push(lines[endLine]);
        endLine++;
    }

    const rawLatex = contentLines.join('\n');
    const name = label || extractLabel(rawLatex) || `${tag === 'ThmNode' ? 'theorem' : 'lemma'}_${start}`;
    const { hypotheses, conclusion } = parseStatement(rawLatex);

    return {
        node: {
            tag,
            name,
            label: name,
            hypotheses,
            conclusion,
            proof: null,
            rawLatex,
            line: start + 1,
        } as ThmNode | LemmaNode,
        endLine,
    };
}

function parseDefinitionEnv(
    lines: string[], start: number, label: string
): { node: DefNode; endLine: number } {
    let endLine = start + 1;
    const contentLines: string[] = [];

    while (endLine < lines.length && !/\\end\{(definition|defn)\}/.test(lines[endLine])) {
        contentLines.push(lines[endLine]);
        endLine++;
    }

    const rawLatex = contentLines.join('\n');
    const name = label || extractLabel(rawLatex) || `def_${start}`;

    return {
        node: {
            tag: 'DefNode',
            name,
            params: [],
            body: parseExpr(rawLatex),
            rawLatex,
            line: start + 1,
        },
        endLine,
    };
}

function parseProofEnv(
    lines: string[], start: number
): { node: ProofNode; endLine: number } {
    let endLine = start + 1;
    const contentLines: string[] = [];

    while (endLine < lines.length && !/\\end\{proof\}/.test(lines[endLine])) {
        contentLines.push(lines[endLine]);
        endLine++;
    }

    const rawLatex = contentLines.join('\n');
    const tactics = extractTactics(rawLatex);
    const strategy = detectStrategy(rawLatex);

    return {
        node: {
            tag: 'ProofNode',
            tactics,
            rawLatex,
            strategy,
            line: start + 1,
        },
        endLine,
    };
}

// ── Statement parser ────────────────────────────────────────

export function parseStatement(raw: string): { hypotheses: HypothesisDecl[]; conclusion: Term } {
    const hypotheses: HypothesisDecl[] = [];

    // Look for patterns like "Let X be ...", "Suppose ...", "If ... then ..."
    // Handles multi-variable: "Let $a, b$ be ...", "Let $p$ be a prime"
    const letMatches = raw.matchAll(/(?:Let|Suppose|Assume)\s+\$([^$]+)\$\s+(?:be\s+)?(?:a\s+)?([^.]+)/gi);
    for (const match of letMatches) {
        const varPart = match[1];
        const descPart = match[2].trim();
        // Split on commas to handle "Let $a, b$ be ..."
        const vars = varPart.split(/\s*,\s*/).map(v => v.trim()).filter(Boolean);
        for (const v of vars) {
            hypotheses.push({
                name: `h_${hypotheses.length}`,
                condition: parseExpr(v),
                description: descPart,
            });
        }
    }

    // "if ... coprime ..."
    const coprimeMatch = raw.match(/\$?(\w+)\$?\s+(?:(?:an?\s+)?integer\s+)?coprime\s+(?:to\s+)?\$?(\w+)\$?/i)
        || raw.match(/coprime\s+(?:to\s+)?\$?(\w+)\$?/i);
    if (coprimeMatch) {
        // If we matched both variables (first pattern), use them; otherwise infer from Let patterns
        const var1 = coprimeMatch[2] ? coprimeMatch[1] : findLastLetVar(hypotheses) || 'a';
        const var2 = coprimeMatch[2] || coprimeMatch[1];
        hypotheses.push({
            name: 'h_coprime',
            condition: mk.app(mk.app(mk.var('Coprime'), mk.var(var1)), mk.var(var2)),
            description: `${var1} coprime to ${var2}`,
        });
    }

    // "... is prime ..."
    const primeMatch = raw.match(/\$?(\w+)\$?\s+(?:is\s+(?:a\s+)?)?prime/i)
        || raw.match(/prime\s+(?:number\s+)?\$?(\w+)\$?/i);
    if (primeMatch) {
        hypotheses.push({
            name: 'h_prime',
            condition: mk.app(mk.var('Prime'), mk.var(primeMatch[1])),
            description: `${primeMatch[1]} is prime`,
        });
    }

    // Extract the main math content for conclusion
    const mathBlocks = [...raw.matchAll(/\$\$([^$]+)\$\$/g), ...raw.matchAll(/\$([^$]+)\$/g)];
    const lastMath = mathBlocks[mathBlocks.length - 1];
    const conclusion = lastMath ? parseExpr(lastMath[1]) : parseExpr(raw);

    return { hypotheses, conclusion };
}

// ── Tactic extraction from proof text ───────────────────────

function extractTactics(proofText: string): Tactic[] {
    const tactics: Tactic[] = [];
    const lower = proofText.toLowerCase();

    if (lower.includes('induction') || lower.includes('inductive')) {
        // Try to find what we're inducting on
        const inductMatch = proofText.match(/induction\s+(?:on\s+)?\$?(\w+)\$?/i);
        tactics.push({ tag: 'Induction', name: inductMatch?.[1] || 'n' });
    }
    if (lower.includes('by contradiction') || lower.includes('suppose not')) {
        tactics.push({ tag: 'Apply', term: mk.axiomRef('LEM') });
    }
    if (lower.includes('by cases') || lower.includes('case analysis') || lower.includes('consider the case') || lower.includes('cases on')) {
        tactics.push({ tag: 'Cases', term: mk.hole('case_scrutinee') });
    }
    if (lower.includes('simplif') || lower.includes('reduces to') || lower.includes('it follows')) {
        tactics.push({ tag: 'Simp', lemmas: [] });
    }
    if (lower.includes('apply') || lower.includes('using')) {
        const applyMatch = proofText.match(/(?:apply|using)\s+(?:Theorem|Lemma|Proposition)?\s*[\d.]*\s*(\w+)?/i);
        if (applyMatch) {
            tactics.push({ tag: 'Apply', term: mk.var(applyMatch[1] || 'hypothesis') });
        }
    }
    if (lower.includes('rewrite') || lower.includes('substitut')) {
        tactics.push({ tag: 'Rewrite', term: mk.hole('rewrite_rule'), direction: 'ltr' });
    }
    if (lower.includes('cancel')) {
        tactics.push({ tag: 'Ring' });
    }
    if (lower.includes('arithmetic') || lower.includes('trivial') || lower.includes('obvious')) {
        tactics.push({ tag: 'Omega' });
    }

    if (tactics.length === 0) {
        tactics.push({ tag: 'Sorry' });
    }

    return tactics;
}

function detectStrategy(proofText: string): string {
    const lower = proofText.toLowerCase();
    if (lower.includes('induction')) return 'induction';
    if (lower.includes('contradiction')) return 'contradiction';
    if (lower.includes('cases') || lower.includes('case ')) return 'case_analysis';
    if (lower.includes('direct')) return 'direct';
    if (lower.includes('construct')) return 'construction';
    return 'unknown';
}

// ── Utility functions ───────────────────────────────────────

function extractTitle(source: string): string {
    const titleMatch = source.match(/\\title\{([^}]+)\}/);
    if (titleMatch) return titleMatch[1];
    const sectionMatch = source.match(/\\section\{([^}]+)\}/);
    if (sectionMatch) return sectionMatch[1];
    return 'Untitled Document';
}

function extractLabel(raw: string): string | null {
    const labelMatch = raw.match(/\\label\{([^}]+)\}/);
    return labelMatch?.[1] ?? null;
}

function extractReferences(raw: string): string[] {
    const refs: string[] = [];
    const refMatches = raw.matchAll(/\\ref\{([^}]+)\}/g);
    for (const match of refMatches) {
        refs.push(match[1]);
    }
    return refs;
}

function sanitizeName(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase() || 'unnamed';
}

function hypothesesToParams(hyps: HypothesisDecl[]): Param[] {
    return hyps.map(h => ({
        name: h.name,
        type: h.condition,
        implicit: false,
    }));
}

function findLastLetVar(hypotheses: HypothesisDecl[]): string | null {
    for (let i = hypotheses.length - 1; i >= 0; i--) {
        const cond = hypotheses[i].condition;
        if (cond.tag === 'Var') return cond.name;
        // Look for the variable name inside parsed expressions
        if (cond.tag === 'App' && cond.arg.tag === 'Var') return cond.arg.name;
    }
    return null;
}
