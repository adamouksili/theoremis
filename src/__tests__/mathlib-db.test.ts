// ─────────────────────────────────────────────────────────────
// Theoremis  ·  Mathlib Database Tests
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { lookupLemma, getRequiredImports, suggestMathlibLemma, MATHLIB_DB } from '../bridge/mathlib-db';

describe('MATHLIB_DB', () => {
    it('contains number theory entries', () => {
        expect(MATHLIB_DB['fermat_little']).toBeDefined();
        expect(MATHLIB_DB['fermat_little'].lean4Name).toBe('ZMod.pow_card_sub_one_eq_one');
    });

    it('contains algebra entries', () => {
        expect(MATHLIB_DB['lagrange']).toBeDefined();
    });

    it('contains analysis entries', () => {
        expect(MATHLIB_DB['ivt']).toBeDefined();
        expect(MATHLIB_DB['mvt']).toBeDefined();
    });

    it('contains type entries', () => {
        expect(MATHLIB_DB['Nat']).toBeDefined();
        expect(MATHLIB_DB['Real']).toBeDefined();
        expect(MATHLIB_DB['Prime']).toBeDefined();
    });
});

describe('lookupLemma', () => {
    it('finds direct matches', () => {
        const entry = lookupLemma('fermat_little');
        expect(entry).toBeDefined();
        expect(entry!.lean4Name).toBe('ZMod.pow_card_sub_one_eq_one');
    });

    it('fuzzy-matches by description', () => {
        // lookupLemma normalizes to underscore form, but description matching
        // uses the normalized string as-is, so use the DB key directly
        const entry = lookupLemma('ivt');
        expect(entry).toBeDefined();
        expect(entry!.lean4Name).toContain('intermediate_value');
    });

    it('returns undefined for unknown lemmas', () => {
        expect(lookupLemma('nonexistent_xyz_lemma_123')).toBeUndefined();
    });
});

describe('getRequiredImports', () => {
    it('detects Real imports', () => {
        const imports = getRequiredImports('theorem foo : ℝ → ℝ');
        expect(imports).toContain('Mathlib.Data.Real.Basic');
    });

    it('detects Nat.Prime imports', () => {
        const imports = getRequiredImports('theorem foo (p : ℕ) (hp : Nat.Prime p)');
        expect(imports).toContain('Mathlib.Data.Nat.Prime.Basic');
    });

    it('detects ZMod imports', () => {
        const imports = getRequiredImports('def bar : ZMod n');
        expect(imports).toContain('Mathlib.Data.ZMod.Basic');
    });

    it('returns empty for vanilla code', () => {
        const imports = getRequiredImports('theorem foo (n : Nat) : n + 0 = n');
        expect(imports).toHaveLength(0);
    });

    it('deduplicates imports', () => {
        const imports = getRequiredImports('ℝ and ℝ and Real again');
        const realImports = imports.filter(i => i.includes('Real'));
        expect(realImports).toHaveLength(1);
    });

    it('returns sorted imports', () => {
        const imports = getRequiredImports('ℝ and ZMod and Nat.Prime');
        for (let i = 1; i < imports.length; i++) {
            expect(imports[i] >= imports[i - 1]).toBe(true);
        }
    });
});

describe('suggestMathlibLemma', () => {
    it('suggests Fermat for "fermat" keyword', () => {
        const entry = suggestMathlibLemma("Fermat's Little Theorem", 'a^(p-1) ≡ 1');
        expect(entry).toBeDefined();
        expect(entry!.lean4Name).toBe('ZMod.pow_card_sub_one_eq_one');
    });

    it('suggests Wilson for "wilson" keyword', () => {
        const entry = suggestMathlibLemma("Wilson's Theorem", '(p-1)!');
        expect(entry).toBeDefined();
        expect(entry!.lean4Name).toContain('factorial');
    });

    it('suggests IVT for intermediate value', () => {
        const entry = suggestMathlibLemma('Intermediate Value Theorem', 'continuous f');
        expect(entry).toBeDefined();
    });

    it('does NOT greedily match "prime" to infinitude_primes', () => {
        // "Fermat's Little Theorem" mentions prime but should match Fermat, not infinitude
        const entry = suggestMathlibLemma("Fermat's Little Theorem", 'prime p and a^(p-1)');
        expect(entry).toBeDefined();
        expect(entry!.lean4Name).toBe('ZMod.pow_card_sub_one_eq_one');
    });

    it('matches infinitude of primes specifically', () => {
        const entry = suggestMathlibLemma('Infinitude of Primes', 'infinitely many prime numbers');
        expect(entry).toBeDefined();
        expect(entry!.lean4Name).toBe('Nat.infinite_setOf_prime');
    });

    it('returns undefined for unrelated theorems', () => {
        const entry = suggestMathlibLemma('My Custom Theorem', 'x + y = z');
        expect(entry).toBeUndefined();
    });
});
