# Mutation-Based Specification Auditing: From Mathematical Hypotheses to AI Safety Properties

**Adam Ouksili** · Rutgers University, Department of Computer Science & Mathematics  
March 2026 · Technical Brief

---

## Summary

We present a technique for automatically detecting unnecessary assumptions in formal specifications via mutation testing. Given a mathematical theorem (or any formal claim with preconditions), we systematically mutate each hypothesis—dropping, weakening, or perturbing it—then search for counterexamples to the modified claim. If no counterexample survives mutation, the hypothesis may be redundant: the specification is over-constrained.

This technique, implemented in Theoremis, achieves **100% precision and 100% recall** on hypothesis necessity detection across a 20-theorem benchmark suite covering number theory, algebra, and elementary analysis. We argue this approach generalizes to specification auditing for AI safety properties.

## The Core Technique

**Input:** A formal claim $C$ with hypotheses $H_1, H_2, \ldots, H_n$ and conclusion $\phi$.

**Process:** For each $H_i$:
1. Construct the mutant $C_i = (H_1 \land \cdots \land H_{i-1} \land H_{i+1} \land \cdots \land H_n) \implies \phi$
2. Generate domain-aware random inputs that *violate* $H_i$ specifically
3. Evaluate $\phi$ under these inputs
4. If $\phi$ fails under some assignment: $H_i$ is **necessary** (counterexample found)
5. If $\phi$ holds across all tests: $H_i$ is **potentially redundant**

**Mutation operators (7 total):**
- `drop_hypothesis` — remove a precondition entirely
- `weaken_condition` — relax strict inequalities, broaden quantifiers
- `swap_quantifier` — exchange ∀ and ∃
- `perturb_constant` — modify numeric constants (±1, ×2, etc.)
- `change_domain` — alter the domain of quantification (ℕ→ℤ, ℤ→ℝ)
- `negate_conclusion` — flip the claimed result
- `strengthen_conclusion` — tighten the conclusion (≥ → >)

## Results

On 20 annotated theorems with manually verified ground truth:

| Metric | Hypothesis Necessity | Mutation Detection |
|--------|--------------------:|-------------------:|
| Precision | 100.0% | 90.9% |
| Recall | 100.0% | 100.0% |
| F1 | 100.0% | 95.2% |

15 true positives (correctly identified necessary hypotheses), 4 true negatives (correctly identified redundant hypotheses), 0 false positives, 0 false negatives. Analysis completes in <10ms for 20 theorems.

## Application to AI Safety Specifications

### The specification completeness problem

AI safety properties are typically stated as formal or semi-formal claims with preconditions:

> "If the user has not explicitly authorized action $A$, and the system is in deployment mode, then the agent must not execute $A$."

The critical question is: **are all preconditions necessary?** If "deployment mode" can be dropped and the property still holds, then either:
- The constraint is redundant (wasted engineering effort enforcing it), or
- The testing is insufficient (the property *does* depend on deployment mode, but our test generation didn't find the counterexample)

Both outcomes are valuable information for safety engineers.

### What this technique offers alignment research

1. **Assumption auditing for reward specifications.** RLHF reward models encode implicit assumptions about what "good behavior" means. Mutation testing can systematically check whether each constraint in a reward specification is load-bearing.

2. **Constitutional AI rule analysis.** Constitutional AI uses a set of principles to guide model behavior. Are all principles independent? Does removing principle $k$ change the model's behavior on any test case? This is exactly the `drop_hypothesis` mutation.

3. **Formal verification preprocessing.** Before investing resources in formally verifying a safety property in Lean 4 or Coq, mutation testing can quickly identify which hypotheses are likely necessary—prioritizing verification effort.

4. **Specification debugging.** When a safety property fails verification, mutation analysis can identify which hypothesis is "too strong" (over-constraining the proof search) or "too weak" (allowing counterexamples to slip through).

### Current limitations

- **Numeric domains only.** The current evaluator handles ℕ, ℤ, ℝ (float), Bool, and Prime. Abstract behavioral properties, temporal logic, and game-theoretic specifications are out of scope.
- **Heuristic, not sound.** "No counterexample found" ≠ "hypothesis is unnecessary." The engine runs ~500 random tests per mutation. False negatives are possible for highly constrained domains.
- **LaTeX input only.** The system currently parses LaTeX theorem statements. Direct Lean 4/Coq specification input is planned.

### Research roadmap

1. **Direct Lean 4 specification input** — Parse `.lean` files, extract theorem statements with hypotheses, run mutation analysis without the LaTeX→IR round-trip.
2. **Behavioral property domains** — Extend the evaluator to handle state machines, trace properties, and temporal logic specifications.
3. **Compositional analysis** — Given a system with properties $P_1, \ldots, P_k$, identify which properties are independent vs. which are implied by combinations of others.
4. **Integration with LLM safety evaluations** — Use mutation testing to audit the assumptions underlying automated safety benchmarks.

## Implementation

Theoremis is implemented in TypeScript (~15,000 lines), runs in the browser and via CLI, and is open-source under MIT license.

- **Repository:** [github.com/adamouksili/theoremis](https://github.com/adamouksili/theoremis)
- **Demo:** [theoremis.com](https://theoremis.com)
- **CLI:** `npx theoremis paper.tex`
- **428 tests passing**, clean `tsc`, Vite production build

## Contact

Adam Ouksili · [adamouksili.com](https://adamouksili.com) · Computer Science & Mathematics, Rutgers University–New Brunswick
