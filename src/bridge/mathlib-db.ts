// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Mathlib4 Lemma Database
// Maps common mathematical concepts to their Mathlib4 names
// and required imports for correct Lean 4 emission
// ─────────────────────────────────────────────────────────────

export interface MathlibEntry {
    lean4Name: string;
    import: string;
    description: string;
    params?: string[];
}

// ── Core number theory ──────────────────────────────────────

const NUMBER_THEORY: Record<string, MathlibEntry> = {
    'fermat_little': {
        lean4Name: 'ZMod.pow_card_sub_one_eq_one',
        import: 'Mathlib.FieldTheory.Finite.Basic',
        description: "Fermat's Little Theorem: a^(p-1) ≡ 1 (mod p)",
        params: ['(p : ℕ)', '(hp : Nat.Prime p)', '(a : ZMod p)', '(ha : a ≠ 0)'],
    },
    'eulers_theorem': {
        lean4Name: 'ZMod.pow_totient_eq_one',
        import: 'Mathlib.FieldTheory.Finite.Basic',
        description: "Euler's theorem: a^φ(n) ≡ 1 (mod n) when gcd(a,n) = 1",
    },
    'bezout': {
        lean4Name: 'Nat.gcd_eq_gcd_ab',
        import: 'Mathlib.Data.Nat.GCD.Basic',
        description: "Bézout's identity: ∃ x y, a*x + b*y = gcd(a,b)",
    },
    'infinitude_primes': {
        lean4Name: 'Nat.infinite_setOf_prime',
        import: 'Mathlib.Data.Nat.Prime.Infinite',
        description: 'There are infinitely many primes',
    },
    'fundamental_arithmetic': {
        lean4Name: 'Nat.factors_unique',
        import: 'Mathlib.Data.Nat.Factors',
        description: 'Fundamental theorem of arithmetic (unique factorization)',
    },
    'wilsons_theorem': {
        lean4Name: 'Nat.Prime.factorial_mulInv_atFin',
        import: 'Mathlib.NumberTheory.Wilson',
        description: "Wilson's theorem: (p-1)! ≡ -1 (mod p)",
    },
    'chinese_remainder': {
        lean4Name: 'ZMod.chineseRemainder',
        import: 'Mathlib.Data.ZMod.Basic',
        description: 'Chinese remainder theorem',
    },
    'quadratic_reciprocity': {
        lean4Name: 'ZMod.quadraticReciprocity',
        import: 'Mathlib.NumberTheory.LegendreSymbol.QuadraticReciprocity',
        description: 'Quadratic reciprocity',
    },
};

// ── Algebra ─────────────────────────────────────────────────

const ALGEBRA: Record<string, MathlibEntry> = {
    'lagrange': {
        lean4Name: 'Subgroup.card_dvd_of_mem',
        import: 'Mathlib.GroupTheory.Lagrange',
        description: "Lagrange's theorem: |H| divides |G|",
    },
    'cayley': {
        lean4Name: 'MulEquiv.Perm.ofGroup',
        import: 'Mathlib.GroupTheory.Perm.Cycle.Concrete',
        description: "Cayley's theorem: every group embeds in a symmetric group",
    },
    'sylow_1': {
        lean4Name: 'Sylow.exists_subgroup_card_pow_prime',
        import: 'Mathlib.GroupTheory.Sylow',
        description: "Sylow's first theorem",
    },
    'ring_hom_surjective': {
        lean4Name: 'RingHom.surjective_iff',
        import: 'Mathlib.RingTheory.Ideal.Basic',
        description: 'Ring homomorphism surjectivity criterion',
    },
};

// ── Analysis ────────────────────────────────────────────────

const ANALYSIS: Record<string, MathlibEntry> = {
    'ivt': {
        lean4Name: 'IsPreconnected.intermediate_value',
        import: 'Mathlib.Topology.Order.IntermediateValue',
        description: 'Intermediate value theorem',
    },
    'mvt': {
        lean4Name: 'exists_ratio_hasDerivAt_eq_ratio_slope',
        import: 'Mathlib.Analysis.Calculus.MeanValue',
        description: 'Mean value theorem',
    },
    'bolzano_weierstrass': {
        lean4Name: 'IsCompact.exists_clusterPt',
        import: 'Mathlib.Topology.Sequences',
        description: 'Bolzano–Weierstrass: bounded sequences have convergent subsequences',
    },
    'ftc_1': {
        lean4Name: 'intervalIntegral.integral_hasDerivAt_of_tendsto_ae',
        import: 'Mathlib.MeasureTheory.Integral.FundThmCalculus',
        description: 'Fundamental theorem of calculus (part 1)',
    },
    'ftc_2': {
        lean4Name: 'intervalIntegral.integral_eq_sub_of_hasDerivAt',
        import: 'Mathlib.MeasureTheory.Integral.FundThmCalculus',
        description: 'Fundamental theorem of calculus (part 2)',
    },
};

// ── Combinatorics ───────────────────────────────────────────

const COMBINATORICS: Record<string, MathlibEntry> = {
    'pigeonhole': {
        lean4Name: 'Finset.exists_ne_map_eq_of_card_lt',
        import: 'Mathlib.Combinatorics.Pigeonhole',
        description: 'Pigeonhole principle',
    },
    'binomial_theorem': {
        lean4Name: 'Commute.add_pow',
        import: 'Mathlib.Data.Nat.Choose.Sum',
        description: 'Binomial theorem',
    },
};

// ── Common types & tactics ──────────────────────────────────

const TYPES: Record<string, MathlibEntry> = {
    'Nat': { lean4Name: 'Nat', import: '', description: 'Natural numbers' },
    'Int': { lean4Name: 'Int', import: '', description: 'Integers' },
    'Real': { lean4Name: 'ℝ', import: 'Mathlib.Data.Real.Basic', description: 'Real numbers' },
    'Complex': { lean4Name: 'ℂ', import: 'Mathlib.Analysis.SpecialFunctions.Complex.Log', description: 'Complex numbers' },
    'Finset': { lean4Name: 'Finset', import: 'Mathlib.Data.Finset.Basic', description: 'Finite sets' },
    'ZMod': { lean4Name: 'ZMod', import: 'Mathlib.Data.ZMod.Basic', description: 'Integers mod n' },
    'Polynomial': { lean4Name: 'Polynomial', import: 'Mathlib.Data.Polynomial.Basic', description: 'Polynomials' },
    'Matrix': { lean4Name: 'Matrix', import: 'Mathlib.Data.Matrix.Basic', description: 'Matrices' },
    'Prime': { lean4Name: 'Nat.Prime', import: 'Mathlib.Data.Nat.Prime.Basic', description: 'Primality predicate' },
    'Even': { lean4Name: 'Even', import: 'Mathlib.Algebra.Parity', description: 'Evenness predicate' },
    'Odd': { lean4Name: 'Odd', import: 'Mathlib.Algebra.Parity', description: 'Oddness predicate' },
};

// ── Full database ───────────────────────────────────────────

export const MATHLIB_DB: Record<string, MathlibEntry> = {
    ...NUMBER_THEORY,
    ...ALGEBRA,
    ...ANALYSIS,
    ...COMBINATORICS,
    ...TYPES,
};

// ── Lookup functions ────────────────────────────────────────

export function lookupLemma(name: string): MathlibEntry | undefined {
    const normalized = name.toLowerCase()
        .replace(/['']/g, '')
        .replace(/\s+/g, '_')
        .replace(/theorem|lemma|the\b/gi, '')
        .trim();

    // Direct lookup
    if (MATHLIB_DB[normalized]) return MATHLIB_DB[normalized];

    // Fuzzy match by description
    for (const [, entry] of Object.entries(MATHLIB_DB)) {
        if (entry.description.toLowerCase().includes(normalized)) {
            return entry;
        }
    }

    return undefined;
}

export function getRequiredImports(leanCode: string): string[] {
    const imports = new Set<string>();

    for (const [, entry] of Object.entries(MATHLIB_DB)) {
        if (entry.import && leanCode.includes(entry.lean4Name)) {
            imports.add(entry.import);
        }
    }

    // Scan for common types
    if (leanCode.includes('ℝ') || leanCode.includes('Real')) {
        imports.add('Mathlib.Data.Real.Basic');
    }
    if (leanCode.includes('ℂ') || leanCode.includes('Complex')) {
        imports.add('Mathlib.Analysis.SpecialFunctions.Complex.Log');
    }
    if (leanCode.includes('ZMod')) {
        imports.add('Mathlib.Data.ZMod.Basic');
    }
    if (leanCode.includes('Nat.Prime')) {
        imports.add('Mathlib.Data.Nat.Prime.Basic');
    }
    if (leanCode.includes('Finset')) {
        imports.add('Mathlib.Data.Finset.Basic');
    }

    return Array.from(imports).sort();
}

export function suggestMathlibLemma(theoremName: string, statement: string): MathlibEntry | undefined {
    const combined = `${theoremName} ${statement}`.toLowerCase();

    const keywords: Array<[string, string]> = [
        // Specific named theorems first (order matters!)
        ['fermat', 'fermat_little'],
        ['euler', 'eulers_theorem'],
        ['bezout', 'bezout'],
        ['bézout', 'bezout'],
        ['wilson', 'wilsons_theorem'],
        ['chinese remainder', 'chinese_remainder'],
        ['quadratic reciprocity', 'quadratic_reciprocity'],
        ['lagrange', 'lagrange'],
        ['cayley', 'cayley'],
        ['sylow', 'sylow_1'],
        ['intermediate value', 'ivt'],
        ['mean value', 'mvt'],
        ['bolzano', 'bolzano_weierstrass'],
        ['fundamental theorem of calculus', 'ftc_1'],
        ['pigeonhole', 'pigeonhole'],
        ['binomial', 'binomial_theorem'],
        // Generic 'prime' only when talking about infinitely many primes
        ['infinitely many prime', 'infinitude_primes'],
        ['infinitude of prime', 'infinitude_primes'],
        ['infinite primes', 'infinitude_primes'],
    ];

    for (const [keyword, dbKey] of keywords) {
        if (combined.includes(keyword)) {
            return MATHLIB_DB[dbKey];
        }
    }

    return undefined;
}
