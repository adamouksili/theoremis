import { describe, it, expect } from 'vitest';
import { parseNetworkJSON, parseSafetySpec } from '../nn/nn-parser';

// ── parseNetworkJSON ────────────────────────────────────────

describe('parseNetworkJSON', () => {

    it('should parse a valid single-layer network', () => {
        const json = JSON.stringify({
            name: 'single',
            layers: [
                { weights: [[0.5, -0.3], [0.7, 0.1]], biases: [0.1, -0.2], activation: 'relu' },
            ],
        });
        const model = parseNetworkJSON(json);

        expect(model.name).toBe('single');
        expect(model.inputDim).toBe(2);
        expect(model.outputDim).toBe(2);
        expect(model.layers).toHaveLength(1);
        expect(model.layers[0]!.weights).toEqual([[0.5, -0.3], [0.7, 0.1]]);
        expect(model.layers[0]!.biases).toEqual([0.1, -0.2]);
        expect(model.layers[0]!.activation).toBe('relu');
    });

    it('should parse a valid multi-layer network with dimension chaining', () => {
        const json = JSON.stringify({
            name: 'multi',
            layers: [
                { weights: [[1, 2], [3, 4], [5, 6]], biases: [0, 0, 0], activation: 'relu' },
                { weights: [[1, 1, 1]], biases: [0.5], activation: 'linear' },
            ],
        });
        const model = parseNetworkJSON(json);

        expect(model.inputDim).toBe(2);
        expect(model.outputDim).toBe(1);
        expect(model.layers).toHaveLength(2);
        expect(model.layers[0]!.activation).toBe('relu');
        expect(model.layers[1]!.activation).toBe('linear');
    });

    it('should throw on invalid JSON string', () => {
        expect(() => parseNetworkJSON('{not valid json}')).toThrow('Invalid JSON');
    });

    it('should throw when layers field is missing', () => {
        const json = JSON.stringify({ name: 'no-layers' });
        expect(() => parseNetworkJSON(json)).toThrow('at least one layer');
    });

    it('should throw when layers array is empty', () => {
        const json = JSON.stringify({ layers: [] });
        expect(() => parseNetworkJSON(json)).toThrow('at least one layer');
    });

    it('should throw when weights or biases are missing', () => {
        const noWeights = JSON.stringify({ layers: [{ biases: [0] }] });
        expect(() => parseNetworkJSON(noWeights)).toThrow('missing weights or biases');

        const noBiases = JSON.stringify({ layers: [{ weights: [[1]] }] });
        expect(() => parseNetworkJSON(noBiases)).toThrow('missing weights or biases');
    });

    it('should throw on empty weight matrix', () => {
        const json = JSON.stringify({ layers: [{ weights: [], biases: [] }] });
        expect(() => parseNetworkJSON(json)).toThrow('empty weight matrix');
    });

    it('should throw on dimension mismatch between layers', () => {
        const json = JSON.stringify({
            layers: [
                { weights: [[1, 2]], biases: [0] },
                { weights: [[1, 2, 3]], biases: [0] },
            ],
        });
        expect(() => parseNetworkJSON(json)).toThrow('input dim');
    });

    it('should throw when biases length mismatches output dim', () => {
        const json = JSON.stringify({
            layers: [{ weights: [[1, 2], [3, 4]], biases: [0] }],
        });
        expect(() => parseNetworkJSON(json)).toThrow('biases length');
    });

    it('should throw on irregular weight matrix (rows with different widths)', () => {
        const json = JSON.stringify({
            layers: [{ weights: [[1, 2], [3]], biases: [0, 0] }],
        });
        expect(() => parseNetworkJSON(json)).toThrow('expected 2 columns, got 1');
    });

    it('should default activation to relu when not specified', () => {
        const json = JSON.stringify({
            layers: [{ weights: [[1]], biases: [0] }],
        });
        const model = parseNetworkJSON(json);
        expect(model.layers[0]!.activation).toBe('relu');
    });

    it('should support linear activation', () => {
        const json = JSON.stringify({
            layers: [{ weights: [[1]], biases: [0], activation: 'linear' }],
        });
        const model = parseNetworkJSON(json);
        expect(model.layers[0]!.activation).toBe('linear');
    });

    it('should default name to "network" when not provided', () => {
        const json = JSON.stringify({
            layers: [{ weights: [[1]], biases: [0] }],
        });
        expect(parseNetworkJSON(json).name).toBe('network');
    });
});

// ── parseSafetySpec ─────────────────────────────────────────

describe('parseSafetySpec', () => {

    it('should parse simple input bounds and an output constraint', () => {
        const dsl = `
            input [-1, 1], [0, 2]
            output [0] > 0.5
        `;
        const spec = parseSafetySpec(dsl, 2, 1);

        expect(spec.inputBounds).toEqual([
            { lo: -1, hi: 1 },
            { lo: 0, hi: 2 },
        ]);
        expect(spec.outputConstraints).toHaveLength(1);
        expect(spec.outputConstraints[0]!.coeffs).toEqual([-1]);
        expect(spec.outputConstraints[0]!.rhs).toBe(-0.5);
    });

    it('should parse named input bounds (x0 in [...], x1 in [...])', () => {
        const dsl = `
            input x0 in [-2, 2], x1 in [0, 1]
            output [0] > 0
        `;
        const spec = parseSafetySpec(dsl, 2, 1);
        expect(spec.inputBounds).toEqual([
            { lo: -2, hi: 2 },
            { lo: 0, hi: 1 },
        ]);
    });

    it('should default missing input bounds to [-1, 1]', () => {
        const dsl = `
            input [0, 1]
            output [0] > 0
        `;
        const spec = parseSafetySpec(dsl, 3, 1);

        expect(spec.inputBounds).toHaveLength(3);
        expect(spec.inputBounds[0]).toEqual({ lo: 0, hi: 1 });
        expect(spec.inputBounds[1]).toEqual({ lo: -1, hi: 1 });
        expect(spec.inputBounds[2]).toEqual({ lo: -1, hi: 1 });
    });

    it('should parse output > constraint (converted to ≤ form)', () => {
        const dsl = 'output [0] > 0.5';
        const spec = parseSafetySpec(dsl, 1, 2);
        const c = spec.outputConstraints[0]!;
        expect(c.coeffs[0]).toBe(-1);
        expect(c.rhs).toBe(-0.5);
    });

    it('should parse output < constraint (converted to ≤ form)', () => {
        const dsl = 'output [1] < 0.3';
        const spec = parseSafetySpec(dsl, 1, 2);
        const c = spec.outputConstraints[0]!;
        expect(c.coeffs[1]).toBe(1);
        expect(c.rhs).toBe(0.3);
    });

    it('should parse output >= and <= constraints', () => {
        const dsl = `
            output [0] >= 0.1
            output [1] <= 0.9
        `;
        const spec = parseSafetySpec(dsl, 1, 2);

        const ge = spec.outputConstraints[0]!;
        expect(ge.coeffs).toEqual([-1, 0]);
        expect(ge.rhs).toBe(-0.1);

        const le = spec.outputConstraints[1]!;
        expect(le.coeffs).toEqual([0, 1]);
        expect(le.rhs).toBe(0.9);
    });

    it('should parse a difference constraint ([0] - [1] > 0.2)', () => {
        const dsl = 'output [0] - [1] > 0.2';
        const spec = parseSafetySpec(dsl, 1, 2);
        const c = spec.outputConstraints[0]!;
        expect(c.coeffs).toEqual([-1, 1]);
        expect(c.rhs).toBe(-0.2);
    });

    it('should throw when output index is out of range', () => {
        const dsl = 'output [5] > 0';
        expect(() => parseSafetySpec(dsl, 1, 2)).toThrow('out of range');
    });

    it('should throw when there are no output constraints', () => {
        const dsl = 'input [-1, 1]';
        expect(() => parseSafetySpec(dsl, 1, 1)).toThrow('at least one output constraint');
    });

    it('should ignore comment lines', () => {
        const dsl = `
            // this is a comment
            input [-1, 1]
            // another comment
            output [0] > 0
        `;
        const spec = parseSafetySpec(dsl, 1, 1);
        expect(spec.outputConstraints).toHaveLength(1);
    });

    it('should ignore empty lines', () => {
        const dsl = `

            input [-1, 1]

            output [0] > 0

        `;
        const spec = parseSafetySpec(dsl, 1, 1);
        expect(spec.inputBounds).toEqual([{ lo: -1, hi: 1 }]);
        expect(spec.outputConstraints).toHaveLength(1);
    });

    it('should throw on invalid constraint format', () => {
        const dsl = 'output hello world';
        expect(() => parseSafetySpec(dsl, 1, 1)).toThrow('Cannot parse output constraint');
    });
});
