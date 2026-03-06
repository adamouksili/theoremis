// ─────────────────────────────────────────────────────────────
// Theoremis · Neural Network Verification — Types
// Piecewise-linear ReLU network model + safety specifications
// ─────────────────────────────────────────────────────────────

/** A single dense layer: y = activation(W·x + b) */
export interface NNLayer {
    weights: number[][];   // shape: [outputDim, inputDim]
    biases: number[];      // shape: [outputDim]
    activation: 'relu' | 'linear';
}

/** A feedforward neural network */
export interface NNModel {
    name: string;
    layers: NNLayer[];
    inputDim: number;
    outputDim: number;
}

/** An interval [lo, hi] representing a closed bound */
export interface Interval {
    lo: number;
    hi: number;
}

/** Linear inequality constraint: coeffs·x ≤ rhs */
export interface LinearConstraint {
    coeffs: number[];
    rhs: number;
    /** Human-readable label, e.g. "output[0] ≤ 0.3" */
    label: string;
}

/** Safety specification: input domain + output constraints */
export interface SafetySpec {
    /** Per-dimension input bounds */
    inputBounds: Interval[];
    /** Linear inequality constraints on output */
    outputConstraints: LinearConstraint[];
}

/** Proof certificate — chain of per-layer interval bounds */
export interface ProofCertificate {
    /** Per-layer output intervals (including final output) */
    layerBounds: Interval[][];
    /** Which constraints were verified */
    verifiedConstraints: string[];
}

/** A concrete input that violates a safety constraint */
export interface Counterexample {
    input: number[];
    output: number[];
    violatedConstraint: string;
}

/** Result of running the verifier */
export interface VerificationResult {
    status: 'safe' | 'unsafe' | 'inconclusive';
    /** Present when status === 'safe' */
    certificate?: ProofCertificate;
    /** Present when status === 'unsafe' */
    counterexample?: Counterexample;
    /** Human-readable summary */
    summary: string;
    /** Time taken in ms */
    timeMs: number;
}
