# Mutation-Based Hypothesis Necessity Testing for Mathematical Theorem Statements

**Target venue:** ITP 2027 (Interactive Theorem Proving) or CPP 2027 (Certified Programs and Proofs)  
**Page limit:** 16 pages (LIPIcs format)  
**Submission deadline:** ~February 2027

---

## Paper Structure

### 1. Title & Authors

> **Mutation-Based Hypothesis Necessity Testing for Mathematical Theorem Statements**
>
> Adam Ouksili  
> Department of Computer Science & Mathematics, Rutgers University–New Brunswick

### 2. Abstract (~150 words)

**Key claims to make:**
- We present a technique for automatically detecting unnecessary hypotheses in mathematical theorem statements via mutation testing
- We implement 7 mutation operators over a λΠω intermediate representation
- We evaluate on a benchmark of [N] annotated theorems across number theory, algebra, and analysis
- We achieve [X]% precision and [Y]% recall on hypothesis necessity detection
- We discuss limitations (soundness, domain coverage) and applications to specification auditing

**Current numbers (will update as benchmark grows):**
- 20 theorems, 100% precision, 100% recall for hypothesis necessity
- 90.9% precision, 100% recall for mutation detection
- <10ms total analysis time

### 3. Introduction (1.5 pages)

**Paragraph 1:** The problem. When writing mathematics, authors state theorems with hypotheses. Are all hypotheses necessary? Identifying redundant hypotheses is valuable for (a) mathematical exposition, (b) formalization effort in proof assistants, (c) specification auditing.

**Paragraph 2:** Existing approaches. Manual review. Type-checking in Lean/Coq detects type errors but not unnecessary hypotheses. `#check` and `#lint` in Mathlib catch some issues but don't systematically test hypothesis necessity.

**Paragraph 3:** Our approach. Mutation testing from software engineering, adapted for mathematical specifications. We systematically mutate each hypothesis and search for counterexamples via domain-aware random testing.

**Paragraph 4:** Contributions.
1. A mutation-based framework for hypothesis necessity testing (Section 3)
2. An implementation over a λΠω IR with BigInt modular arithmetic (Section 4)
3. An evaluation on [N] annotated theorems (Section 5)
4. Discussion of applications to formal specification auditing (Section 6)

### 4. Background (1.5 pages)

**4.1 Mutation testing in software engineering**
- Original idea: DeMillo, Lipton, Sayward (1978)
- Competent programmer hypothesis, coupling effect
- Mutation operators for programs vs. our mutation operators for specifications

**4.2 Property-based testing**
- QuickCheck (Claessen & Hughes, 2000)
- SmallCheck, LeanCheck
- Our evaluator as a specialized QuickCheck for mathematical domains

**4.3 Hypothesis analysis in proof assistants**
- Lean 4 `#check`, unused variable warnings
- Coq `Set Suggest Proof Using`
- Isabelle `sledgehammer` relevance filtering
- None of these do *mutation-based* hypothesis testing

### 5. Approach (3 pages)

**5.1 Intermediate representation**
- λΠω calculus with: Var, Literal, Lam, App, Pi, Sigma, LetIn, Sort, ForAll, Exists, BinOp, Equiv, etc.
- 18 term variants
- Axiom bundles (LEM, Choice, Funext, etc.)
- Figure: Grammar of the IR

**5.2 Mutation operators**
- Table of all 7 operators with examples
- `drop_hypothesis`: removes a precondition, tests conclusion with hypothesis-violating inputs
- `weaken_condition`: relaxes inequalities (> → ≥, etc.)
- `swap_quantifier`: exchanges ∀ and ∃
- `perturb_constant`: modifies numeric literals
- `change_domain`: alters quantifier domains (ℕ→ℤ, ℤ→ℝ)
- `negate_conclusion`: flips the sign of the conclusion
- `strengthen_conclusion`: tightens (≥ → >, = → <)

**5.3 Domain-aware input generation**
- Generators for ℕ, ℤ, ℝ (float), Bool, Prime
- Targeted generation: when dropping "p is prime," generate composite numbers
- BigInt modular arithmetic for precise evaluation of modular expressions

**5.4 The analysis algorithm**
- Pseudocode for the full pipeline
- For each hypothesis: mutate → generate violating inputs → evaluate → classify
- Confidence scoring based on test count and failure rate

### 6. Implementation (1.5 pages)

**6.1 Parser**
- LaTeX → Math-AST: recursive descent parser, ~60+ LaTeX commands
- Math-AST → λΠω IR: `documentToIR` with axiom bundle threading
- Figure: Pipeline diagram

**6.2 Evaluator**
- BigInt `modPow` for Fermat's Little Theorem etc.
- Domain-specific generators
- Precondition checking (skip tests where hypotheses aren't met)

**6.3 Engineering**
- TypeScript, ~15,000 lines
- 428 tests, Vitest
- CLI (`cli/lint.ts`), Web IDE, Vercel deployment

### 7. Evaluation (3 pages)

**7.1 Benchmark suite**
- [N] theorems from: number theory, algebra, elementary analysis
- Each annotated with ground truth: hypothesis necessary/redundant, mutation caught/survives
- Annotation format and validation process

**7.2 Metrics**
- Precision, recall, F1 for hypothesis necessity detection
- Precision, recall, F1 for mutation detection
- Table of results
- Analysis of false positives and false negatives

**7.3 Case studies**
- Fermat's Little Theorem: all 3 hypotheses correctly identified as necessary
- Square Non-Negativity: no hypotheses, mutation analysis confirms robustness
- Square Positive With Prime: redundant "prime" hypothesis correctly identified
- Wilson's Theorem: BigInt modular evaluation catches hypothesis violations

**7.4 Performance**
- Time per theorem
- Scaling with number of hypotheses and mutations

### 8. Threats to Validity (0.5 pages)

- **Soundness:** "no counterexample" ≠ "hypothesis unnecessary." Heuristic, not a proof.
- **Benchmark bias:** author-annotated ground truth. Mitigation: cross-validation, independent annotation.
- **Domain limitation:** only numeric/boolean domains. Abstract algebra, topology out of scope.
- **Parser coverage:** LaTeX subset, not all valid mathematical notation.

### 9. Related Work (1.5 pages)

- **Mutation testing for programs:** Jia & Harman (2011) survey. Our contribution: mutation testing for *specifications*, not *programs*.
- **Property-based testing:** QuickCheck, Hypothesis, fast-check. Our contribution: domain-aware generation with hypothesis-violating inputs.
- **Proof relevance:** Blanchette et al. (Sledgehammer), Kaliszyk & Urban (MaSh). These filter lemma libraries; we test hypothesis *necessity* within a single theorem.
- **Specification testing:** Counterexample generators in Alloy (Jackson), Nitpick/Quickcheck for Isabelle (Bulwahn). Closest related work — but they test entire specs, not individual hypothesis necessity.
- **Formal methods for AI safety:** Seshia et al. (2016), Amodei et al. (2016). We connect mutation testing to specification completeness for safety properties.

### 10. Conclusion & Future Work (0.5 pages)

- Summary of contributions
- Future: direct Lean 4 input, non-numeric domains, compositional specification analysis
- Vision: mutation-based specification auditing as a general technique for any domain with formal claims

### 11. References

**Key citations to include:**
- Claessen & Hughes (2000) — QuickCheck
- DeMillo, Lipton, Sayward (1978) — Mutation testing
- Jia & Harman (2011) — Mutation testing survey
- de Moura & Ullrich (2021) — Lean 4
- Bulwahn (2012) — Quickcheck for Isabelle
- Blanchette et al. (2016) — Sledgehammer
- Jackson (2002) — Alloy
- Seshia et al. (2016) — Formal methods for AI safety

---

## TODO Before Submission

- [ ] Expand benchmark to 50-100 theorems
- [ ] Get independent annotation (ask a professor or PhD student to verify ground truth)
- [ ] Run on real Mathlib theorems (parse Lean 4 → extract hypotheses → mutate)
- [ ] Write the actual prose (this skeleton is structure only)
- [ ] Format in LIPIcs LaTeX template
- [ ] Find a faculty co-author / advisor (strongly recommended for ITP)
