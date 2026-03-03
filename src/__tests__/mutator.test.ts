import { describe, expect, it } from 'vitest';
import { generateMutations } from '../engine/mutator';
import { BUNDLES, mk, type Theorem, type Term } from '../core/ir';

function makeTheorem(statement: Term, params: Theorem['params'] = []): Theorem {
    return {
        tag: 'Theorem',
        name: 'test',
        params,
        statement,
        proof: [{ tag: 'Sorry' }],
        axiomBundle: BUNDLES.ClassicalMath,
        metadata: { confidence: 1, dependencies: [] },
    };
}

describe('generateMutations', () => {
    it('deduplicates structurally equivalent weaken mutations', () => {
        const statement = mk.binOp('↔', mk.var('P'), mk.var('P'));
        const theorem = makeTheorem(statement);

        const mutations = generateMutations(theorem);
        const weaken = mutations.filter(m => m.type === 'weaken_condition');

        // Both forward/backward weakenings of P ↔ P produce P → P; only one should remain.
        expect(weaken).toHaveLength(1);
    });

    it('keeps one drop_hypothesis mutation per parameter', () => {
        const theorem: Theorem = {
            tag: 'Theorem',
            name: 'drop_test',
            params: [
                { name: 'h0', type: mk.var('P'), implicit: false },
                { name: 'h1', type: mk.var('Q'), implicit: false },
            ],
            statement: mk.var('R'),
            proof: [{ tag: 'Sorry' }],
            axiomBundle: BUNDLES.ClassicalMath,
            metadata: { confidence: 1, dependencies: [] },
        };

        const drops = generateMutations(theorem).filter(m => m.type === 'drop_hypothesis');
        expect(drops.map(d => d.droppedParam).sort()).toEqual(['h0', 'h1']);
    });

    it('skips no-op mutation branches on non-mutable statements', () => {
        const theorem = makeTheorem(mk.var('P'));
        const mutations = generateMutations(theorem);

        // No hypotheses, no weaken/strengthen/domain/quantifier mutations.
        expect(mutations.map(m => m.type)).toEqual(['negate_conclusion']);
    });
});
