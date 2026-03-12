// ─────────────────────────────────────────────────────────────
// Theoremis · Neural Network Verification — Parser
// Parse JSON network definitions + safety spec DSL
// ─────────────────────────────────────────────────────────────

import type { NNModel, NNLayer, SafetySpec, Interval, LinearConstraint } from './nn-types';
import { invariant } from '../core/assert';

// ── Network JSON Parser ─────────────────────────────────────

interface RawLayerJSON {
    weights: number[][];
    biases: number[];
    activation?: string;
}

interface RawNetworkJSON {
    name?: string;
    layers: RawLayerJSON[];
}

/**
 * Parse a JSON string into an NNModel.
 * Expected format:
 * ```json
 * {
 *   "name": "safety_classifier",
 *   "layers": [
 *     { "weights": [[0.5, -0.3], [0.7, 0.1]], "biases": [0.1, -0.2], "activation": "relu" },
 *     { "weights": [[0.4, -0.6]], "biases": [0.05], "activation": "linear" }
 *   ]
 * }
 * ```
 */
export function parseNetworkJSON(json: string): NNModel {
    let raw: RawNetworkJSON;
    try {
        raw = JSON.parse(json) as RawNetworkJSON;
    } catch {
        throw new Error('Invalid JSON: could not parse network definition.');
    }

    if (!raw.layers || !Array.isArray(raw.layers) || raw.layers.length === 0) {
        throw new Error('Network must have at least one layer.');
    }

    const layers: NNLayer[] = [];
    let prevDim: number | null = null;

    for (let i = 0; i < raw.layers.length; i++) {
        const rl = raw.layers[i]!;

        if (!Array.isArray(rl.weights) || !Array.isArray(rl.biases)) {
            throw new Error(`Layer ${i}: missing weights or biases.`);
        }

        const outputDim = rl.weights.length;
        invariant(outputDim > 0, `Layer ${i}: empty weight matrix`);

        const inputDim = rl.weights[0]!.length;
        invariant(inputDim > 0, `Layer ${i}: zero input dimension`);

        // Validate all rows have the same width
        for (let r = 0; r < outputDim; r++) {
            if (rl.weights[r]!.length !== inputDim) {
                throw new Error(`Layer ${i}, row ${r}: expected ${inputDim} columns, got ${rl.weights[r]!.length}.`);
            }
        }

        if (rl.biases.length !== outputDim) {
            throw new Error(`Layer ${i}: biases length (${rl.biases.length}) ≠ output dim (${outputDim}).`);
        }

        // Check dimension compatibility with previous layer
        if (prevDim !== null && inputDim !== prevDim) {
            throw new Error(`Layer ${i}: input dim (${inputDim}) ≠ previous output dim (${prevDim}).`);
        }

        const activation = (rl.activation === 'linear') ? 'linear' : 'relu';

        layers.push({ weights: rl.weights, biases: rl.biases, activation });
        prevDim = outputDim;
    }

    const inputDim = layers[0]!.weights[0]!.length;
    const outputDim = layers[layers.length - 1]!.weights.length;

    return {
        name: raw.name ?? 'network',
        layers,
        inputDim,
        outputDim,
    };
}

// ── Safety Spec DSL Parser ──────────────────────────────────

/**
 * Parse a safety specification in a simple DSL.
 * Format:
 * ```
 * input x0 in [-1, 1], x1 in [0, 1]
 * output o0 > 0.5
 * output o1 < 0.3
 * output o0 - o1 > 0.2
 * ```
 *
 * Shorthand (dimension-indexed):
 * ```
 * input [-1, 1], [0, 1]
 * output [0] > 0.5
 * output [1] < 0.3
 * ```
 */
export function parseSafetySpec(dsl: string, inputDim: number, outputDim: number): SafetySpec {
    const lines = dsl.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('//'));
    const inputBounds: Interval[] = [];
    const outputConstraints: LinearConstraint[] = [];

    for (const line of lines) {
        if (line.startsWith('input')) {
            const rest = line.slice(5).trim();
            // Match patterns like: [-1, 1], [0, 1]  OR  x0 in [-1, 1], x1 in [0, 1]
            const intervalRe = /\[([^\]]+)\]/g;
            let match;
            while ((match = intervalRe.exec(rest)) !== null) {
                const parts = match[1]!.split(',').map(s => parseFloat(s.trim()));
                if (parts.length !== 2 || isNaN(parts[0]!) || isNaN(parts[1]!)) {
                    throw new Error(`Invalid input bound: [${match[1]!}]`);
                }
                inputBounds.push({ lo: parts[0]!, hi: parts[1]! });
            }
        } else if (line.startsWith('output')) {
            const rest = line.slice(6).trim();
            const constraint = parseOutputConstraint(rest, outputDim);
            outputConstraints.push(constraint);
        }
    }

    // Fill missing input bounds with [-1, 1] default
    while (inputBounds.length < inputDim) {
        inputBounds.push({ lo: -1, hi: 1 });
    }

    if (outputConstraints.length === 0) {
        throw new Error('Safety spec must include at least one output constraint.');
    }

    return { inputBounds, outputConstraints };
}

/**
 * Parse a single output constraint line.
 * Supports:
 *   [0] > 0.5        →  -x₀ ≤ -0.5
 *   [1] < 0.3        →   x₁ ≤  0.3
 *   [0] - [1] > 0.2  →  -x₀ + x₁ ≤ -0.2
 */
function parseOutputConstraint(s: string, outputDim: number): LinearConstraint {
    const label = `output ${s}`;

    // Try simple patterns first: [idx] op value
    const simpleRe = /^\[(\d+)\]\s*(>|<|>=|<=)\s*([+-]?\d+\.?\d*)$/;
    const simpleMatch = simpleRe.exec(s);
    if (simpleMatch) {
        const idx = parseInt(simpleMatch[1]!);
        const op = simpleMatch[2]!;
        const val = parseFloat(simpleMatch[3]!);

        if (idx >= outputDim) throw new Error(`Output index [${idx}] out of range (dim=${outputDim}).`);

        const coeffs = new Array(outputDim).fill(0);

        // Convert to standard form: coeffs·x ≤ rhs
        if (op === '>' || op === '>=') {
            // x[idx] > val  →  -x[idx] ≤ -val
            coeffs[idx] = -1;
            return { coeffs, rhs: -val, label };
        } else {
            // x[idx] < val  →  x[idx] ≤ val
            coeffs[idx] = 1;
            return { coeffs, rhs: val, label };
        }
    }

    // Difference pattern: [i] - [j] op value
    const diffRe = /^\[(\d+)\]\s*-\s*\[(\d+)\]\s*(>|<|>=|<=)\s*([+-]?\d+\.?\d*)$/;
    const diffMatch = diffRe.exec(s);
    if (diffMatch) {
        const i = parseInt(diffMatch[1]!);
        const j = parseInt(diffMatch[2]!);
        const op = diffMatch[3]!;
        const val = parseFloat(diffMatch[4]!);

        if (i >= outputDim || j >= outputDim) throw new Error(`Output index out of range.`);

        const coeffs = new Array(outputDim).fill(0);

        if (op === '>' || op === '>=') {
            // x[i] - x[j] > val  →  -x[i] + x[j] ≤ -val
            coeffs[i] = -1;
            coeffs[j] = 1;
            return { coeffs, rhs: -val, label };
        } else {
            // x[i] - x[j] < val  →  x[i] - x[j] ≤ val
            coeffs[i] = 1;
            coeffs[j] = -1;
            return { coeffs, rhs: val, label };
        }
    }

    throw new Error(`Cannot parse output constraint: "${s}". Use format like [0] > 0.5`);
}
