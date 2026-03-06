import { describe, expect, it } from 'vitest';
import { verifyNN, formatBoundsTable } from '../nn/nn-verifier';
import type { NNModel, SafetySpec } from '../nn/nn-types';

describe('Neural Network Verifier Engine', () => {

    it('should prove safety using exact interval bound propagation', () => {
        // A simple 1-layer network: y = ReLU(x)
        const model: NNModel = {
            name: 'Tiny-ReLU',
            inputDim: 1,
            outputDim: 1,
            layers: [
                {
                    weights: [[1]],
                    biases: [0],
                    activation: 'relu'
                }
            ]
        };

        // Input between [-1, 1], Output must be <= 1
        const spec: SafetySpec = {
            inputBounds: [{ lo: -1, hi: 1 }],
            outputConstraints: [
                { coeffs: [1], rhs: 1.0, label: 'output <= 1.0' }
            ]
        };

        const result = verifyNN(model, spec);
        expect(result.status).toBe('safe');
        expect(result.certificate).toBeDefined();
        // The bounds of ReLU([-1, 1]) should be [0, 1]
        expect(result.certificate?.layerBounds[0][0].lo).toBe(0);
        expect(result.certificate?.layerBounds[0][0].hi).toBe(1);
    });

    it('should identify counterexamples when constraints are violated', () => {
        // Network: y = 2x
        const model: NNModel = {
            name: 'Linear-Scale',
            inputDim: 1,
            outputDim: 1,
            layers: [
                {
                    weights: [[2]],
                    biases: [0],
                    activation: 'linear'
                }
            ]
        };

        // Input between [0, 2], constraint: output <= 3
        // Violated by x=2 (output=4)
        const spec: SafetySpec = {
            inputBounds: [{ lo: 0, hi: 2 }],
            outputConstraints: [
                { coeffs: [1], rhs: 3.0, label: 'y <= 3' }
            ]
        };

        const result = verifyNN(model, spec);
        expect(result.status).toBe('unsafe');
        expect(result.counterexample).toBeDefined();
        expect(result.counterexample?.violatedConstraint).toBe('y <= 3');
    });

    it('should handle multi-layer exact verification case-splitting correctly (fixing IBP over-approximation)', () => {
        // A network designed to demonstrate IBP over-approximation:
        // h1 = ReLU(x)
        // h2 = ReLU(-x)
        // out = h1 + h2
        // Since x in [-1, 1], standard IBP says h1 in [0, 1] and h2 in [0, 1]
        // Which might imply out could be up to 2.
        // But exactly, out = |x|, so out is exactly in [0, 1].

        const model: NNModel = {
            name: 'Abs-Network',
            inputDim: 1,
            outputDim: 1,
            layers: [
                {
                    weights: [[1], [-1]],
                    biases: [0, 0],
                    activation: 'relu'
                },
                {
                    weights: [[1, 1]],
                    biases: [0],
                    activation: 'linear'
                }
            ]
        };

        const spec: SafetySpec = {
            inputBounds: [{ lo: -1, hi: 1 }],
            outputConstraints: [
                { coeffs: [1], rhs: 1.0, label: 'out <= 1.0' }
            ]
        };

        const result = verifyNN(model, spec);

        // Exact case-split verification will prove this safe, even if pure IBP cannot
        expect(result.status).toBe('safe');
    });

    it('should format interval tables nicely', () => {
        const table = formatBoundsTable({ layers: [{ activation: 'relu' }] } as NNModel, [
            [{ lo: 0.12345, hi: 0.98765 }]
        ]);
        expect(table).toContain('Output (relu):');
        expect(table).toContain('[0.1235, 0.9877]');
    });

});
