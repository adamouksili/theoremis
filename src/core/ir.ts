// ─────────────────────────────────────────────────────────────
// Theoremis  ·  λΠω Intermediate Representation
// The universal middle-layer for mathematical logic
// ─────────────────────────────────────────────────────────────

// ── Universe hierarchy ──────────────────────────────────────

export type Universe =
    | { tag: 'Prop' }
    | { tag: 'Type'; level: number };

export const Prop: Universe = { tag: 'Prop' };
export const Type = (level: number = 0): Universe => ({ tag: 'Type', level });

// ── Axiom system ────────────────────────────────────────────

export type Axiom =
    | 'LEM'           // Law of excluded middle
    | 'Choice'        // Axiom of choice
    | 'Univalence'    // HoTT univalence
    | 'Funext'        // Function extensionality
    | 'Propext'       // Propositional extensionality
    | 'Quotient'      // Quotient types
    | 'ClassicalLogic'; // General classical reasoning

export interface AxiomBundle {
    name: string;
    axioms: Set<Axiom>;
    description: string;
}

export const BUNDLES: Record<string, AxiomBundle> = {
    ClassicalMath: {
        name: 'ClassicalMath',
        axioms: new Set(['LEM', 'Choice', 'Funext', 'Propext']),
        description: 'Standard classical mathematics with full choice',
    },
    ConstructiveHoTT: {
        name: 'ConstructiveHoTT',
        axioms: new Set(['Univalence', 'Funext', 'Quotient']),
        description: 'Homotopy Type Theory (constructive)',
    },
    Lean4Default: {
        name: 'Lean4Default',
        axioms: new Set(['Quotient', 'Propext', 'Choice']),
        description: 'Lean 4 native axiom set',
    },
    MinimalCore: {
        name: 'MinimalCore',
        axioms: new Set(),
        description: 'Pure intuitionistic type theory — no axioms',
    },
};

// ── IR Terms ────────────────────────────────────────────────

export type Term =
    | Var
    | Lam
    | App
    | Pi
    | Sigma
    | Pair
    | Proj
    | LetIn
    | Sort
    | Ind
    | Match
    | Hole
    | AxiomRef
    | Literal
    | BinOp
    | UnaryOp
    | Equiv
    | ForAll
    | Exists;

export interface Var {
    tag: 'Var';
    name: string;
}

export interface Lam {
    tag: 'Lam';
    param: string;
    paramType: Term;
    body: Term;
}

export interface App {
    tag: 'App';
    func: Term;
    arg: Term;
}

export interface Pi {
    tag: 'Pi';
    param: string;
    paramType: Term;
    body: Term;
}

export interface Sigma {
    tag: 'Sigma';
    param: string;
    paramType: Term;
    body: Term;
}

export interface Pair {
    tag: 'Pair';
    fst: Term;
    snd: Term;
}

export interface Proj {
    tag: 'Proj';
    term: Term;
    index: 1 | 2;
}

export interface LetIn {
    tag: 'LetIn';
    name: string;
    type: Term;
    value: Term;
    body: Term;
}

export interface Sort {
    tag: 'Sort';
    universe: Universe;
}

export interface Ind {
    tag: 'Ind';
    name: string;
    type: Term;
    constructors: Constructor[];
}

export interface Constructor {
    name: string;
    type: Term;
}

export interface Match {
    tag: 'Match';
    scrutinee: Term;
    cases: MatchCase[];
}

export interface MatchCase {
    pattern: string;
    bindings: string[];
    body: Term;
}

export interface Hole {
    tag: 'Hole';
    id: string;
    context?: string;
}

export interface AxiomRef {
    tag: 'AxiomRef';
    axiom: Axiom;
}

export interface Literal {
    tag: 'Literal';
    kind: 'Nat' | 'Int' | 'String' | 'Bool';
    value: string;
}

export interface BinOp {
    tag: 'BinOp';
    op: '+' | '-' | '*' | '/' | '^' | '=' | '<' | '>' | '≤' | '≥' | '∧' | '∨' | '→' | '↔' | 'mod' | '∈' | '∉' | '⊆' | '∪' | '∩';
    left: Term;
    right: Term;
}

export interface UnaryOp {
    tag: 'UnaryOp';
    op: '¬' | '-';
    operand: Term;
}

export interface Equiv {
    tag: 'Equiv';
    left: Term;
    right: Term;
    modulus?: Term;
}

export interface ForAll {
    tag: 'ForAll';
    param: string;
    domain: Term;
    body: Term;
}

export interface Exists {
    tag: 'Exists';
    param: string;
    domain: Term;
    body: Term;
}

// ── Tactic language ─────────────────────────────────────────

export type Tactic =
    | { tag: 'Intro'; names: string[] }
    | { tag: 'Apply'; term: Term }
    | { tag: 'Rewrite'; term: Term; direction: 'ltr' | 'rtl' }
    | { tag: 'Induction'; name: string }
    | { tag: 'Cases'; term: Term }
    | { tag: 'Simp'; lemmas: string[] }
    | { tag: 'Omega' }
    | { tag: 'Sorry' }
    | { tag: 'Auto'; depth: number }
    | { tag: 'Seq'; tactics: Tactic[] }
    | { tag: 'Alt'; tactics: Tactic[] }
    | { tag: 'Exact'; term: Term }
    | { tag: 'Ring' }
    | { tag: 'LLMSuggest'; context: string };

// ── Top-level declarations ──────────────────────────────────

export interface Definition {
    tag: 'Definition';
    name: string;
    params: Param[];
    returnType: Term;
    body: Term;
}

export interface Theorem {
    tag: 'Theorem';
    name: string;
    params: Param[];
    statement: Term;
    proof: Tactic[];
    axiomBundle: AxiomBundle;
    metadata: TheoremMeta;
}

export interface Lemma {
    tag: 'Lemma';
    name: string;
    params: Param[];
    statement: Term;
    proof: Tactic[];
}

export interface Param {
    name: string;
    type: Term;
    implicit: boolean;
}

export interface TheoremMeta {
    source?: string;
    lineNumber?: number;
    confidence: number;
    dependencies: string[];
}

export type Declaration = Definition | Theorem | Lemma;

// ── Module (collection of declarations) ─────────────────────

export interface IRModule {
    name: string;
    declarations: Declaration[];
    axiomBundle: AxiomBundle;
    imports: string[];
}

// ── Smart constructors ──────────────────────────────────────

export const mk = {
    var: (name: string): Var => ({ tag: 'Var', name }),
    lam: (param: string, paramType: Term, body: Term): Lam => ({ tag: 'Lam', param, paramType, body }),
    app: (func: Term, arg: Term): App => ({ tag: 'App', func, arg }),
    pi: (param: string, paramType: Term, body: Term): Pi => ({ tag: 'Pi', param, paramType, body }),
    sigma: (param: string, paramType: Term, body: Term): Sigma => ({ tag: 'Sigma', param, paramType, body }),
    pair: (fst: Term, snd: Term): Pair => ({ tag: 'Pair', fst, snd }),
    proj: (term: Term, index: 1 | 2): Proj => ({ tag: 'Proj', term, index }),
    letIn: (name: string, type: Term, value: Term, body: Term): LetIn => ({ tag: 'LetIn', name, type, value, body }),
    sort: (universe: Universe): Sort => ({ tag: 'Sort', universe }),
    hole: (id: string, context?: string): Hole => ({ tag: 'Hole', id, context }),
    axiomRef: (axiom: Axiom): AxiomRef => ({ tag: 'AxiomRef', axiom }),
    nat: (n: number): Literal => ({ tag: 'Literal', kind: 'Nat', value: String(n) }),
    int: (n: number): Literal => ({ tag: 'Literal', kind: 'Int', value: String(n) }),
    bool: (b: boolean): Literal => ({ tag: 'Literal', kind: 'Bool', value: String(b) }),
    binOp: (op: BinOp['op'], left: Term, right: Term): BinOp => ({ tag: 'BinOp', op, left, right }),
    unaryOp: (op: UnaryOp['op'], operand: Term): UnaryOp => ({ tag: 'UnaryOp', op, operand }),
    equiv: (left: Term, right: Term, modulus?: Term): Equiv => ({ tag: 'Equiv', left, right, modulus }),
    forAll: (param: string, domain: Term, body: Term): ForAll => ({ tag: 'ForAll', param, domain, body }),
    exists: (param: string, domain: Term, body: Term): Exists => ({ tag: 'Exists', param, domain, body }),
    arrow: (from: Term, to: Term): Pi => ({ tag: 'Pi', param: '_', paramType: from, body: to }),
    ind: (name: string, type: Term, constructors: Constructor[]): Ind => ({ tag: 'Ind', name, type, constructors }),
    match: (scrutinee: Term, cases: MatchCase[]): Match => ({ tag: 'Match', scrutinee, cases }),
};

// ── Common type constants ───────────────────────────────────

export const Types = {
    Nat: mk.var('ℕ'),
    Int: mk.var('ℤ'),
    Real: mk.var('ℝ'),
    Complex: mk.var('ℂ'),
    Bool: mk.var('Bool'),
    Prop: mk.sort(Prop),
    Type0: mk.sort(Type(0)),
    String: mk.var('String'),
    Set: (t: Term): App => mk.app(mk.var('Set'), t),
    List: (t: Term): App => mk.app(mk.var('List'), t),
    Group: mk.var('Group'),
    Ring: mk.var('Ring'),
    Field: mk.var('Field'),
    TopologicalSpace: mk.var('TopologicalSpace'),
    Graph: mk.var('Graph'),
    Prime: (n: Term): App => mk.app(mk.var('Prime'), n),
    Even: (n: Term): App => mk.app(mk.var('Even'), n),
    Odd: (n: Term): App => mk.app(mk.var('Odd'), n),
    Coprime: (a: Term, b: Term): App => mk.app(mk.app(mk.var('Coprime'), a), b),
    Divides: (a: Term, b: Term): BinOp => mk.binOp('∈', a, mk.app(mk.var('Divisors'), b)),
    ZMod: (n: Term): App => mk.app(mk.var('ZMod'), n),
};
