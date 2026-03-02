# Theoremis

**Hypothesis necessity linter for mathematical proofs** — mutation-based analysis of LaTeX theorem statements.

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![Tests](https://img.shields.io/badge/Tests-428%20passing-brightgreen)
![License](https://img.shields.io/badge/License-MIT-green)

**[Live Demo → theoremis.com](https://theoremis.com)** · **[Source Code](https://github.com/adamouksili/theoremis)**

## What It Does

Theoremis reads LaTeX theorem statements and detects **unnecessary hypotheses** via mutation testing. For each hypothesis, the engine drops it, then searches for counterexamples to the weakened statement. If no counterexample survives, the hypothesis may be redundant.

```
Input:  \begin{theorem} Let $p$ be prime and $a$ coprime to $p$. Then $a^{p-1} ≡ 1 \pmod{p}$. \end{theorem}
Output: ● p prime — necessary (dropping breaks statement: a=2, p=4 → 2³ ≡ 0 mod 4)
        ● a coprime to p — necessary (dropping breaks statement: a=3, p=3 → 3² ≡ 0 mod 3)
```

### Core Technique

1. **Parse** LaTeX into a λΠω intermediate representation with full quantifier/predicate structure
2. **Mutate** — 7 mutation operators: `drop_hypothesis`, `weaken_condition`, `swap_quantifier`, `perturb_constant`, `change_domain`, `negate_conclusion`, `strengthen_conclusion`
3. **Evaluate** — BigInt modular arithmetic evaluator with domain-aware random input generation
4. **Report** — Classify each hypothesis as necessary or potentially redundant

## Benchmark Results

On our 20-theorem annotated benchmark suite (`bench/fixtures/`):

| Metric | Hypothesis Detection | Mutation Detection |
|--------|--------------------:|-------------------:|
| Precision | **100.0%** | **90.9%** |
| Recall | **100.0%** | **100.0%** |
| F1 | **100.0%** | **95.2%** |

```bash
npm run bench  # Reproduce these numbers
```

## Quick Start

### CLI Linter

```bash
npm install
npx tsx cli/lint.ts paper.tex          # Lint a single file
npx tsx cli/lint.ts *.tex --format json # Machine-readable output
npx tsx cli/lint.ts *.tex --format github # GitHub Actions annotations
```

### Web IDE

```bash
npm run dev    # Start dev server at http://localhost:5173
npm run build  # Production build
npm test       # Run all 428 tests
```

## Architecture

```
LaTeX → Parser → Math-AST → λΠω IR → Mutation Engine
                                          │
                              ┌───────────┼───────────┐
                              ▼           ▼           ▼
                        drop_hypothesis  weaken    perturb
                              │           │           │
                              └───────────┼───────────┘
                                          ▼
                                  BigInt Evaluator
                                  (counterexample search)
                                          ▼
                                  Hypothesis Report
```

### Key Modules

| Module | Path | Purpose |
|--------|------|---------|
| **IR** | `src/core/ir.ts` | λΠω types: 18 term variants, axiom bundles |
| **Type-Checker** | `src/core/typechecker.ts` | Bidirectional inference, alpha-equivalence |
| **Parser** | `src/parser/latex.ts` | Recursive descent, ~60+ LaTeX commands |
| **Mutator** | `src/engine/mutator.ts` | 7 mutation operators on theorem IR |
| **Evaluator** | `src/engine/evaluator.ts` | BigInt `modPow`, domain-aware generators |
| **Counterexample** | `src/engine/counterexample.ts` | Orchestrates mutation + evaluation |
| **CLI** | `cli/lint.ts` | Hypothesis linter CLI (text/json/github output) |

## Limitations

- **Heuristic, not a proof.** "No counterexample found" ≠ "hypothesis is necessary." The engine tests ~500 random inputs per mutation. False negatives are possible for highly constrained domains.
- **Parser covers a subset of LaTeX.** ~60+ commands, common environments. Custom macros, TikZ, unusual formatting produce parse errors.
- **Numeric domains only.** QuickCheck generates ℕ, ℤ, ℝ (float), Bool, Prime. Abstract algebra, topology, measure theory are out of scope.
- **The type-checker checks well-formedness, not proof validity.** It does not verify that a proof is correct — it validates IR structure.

## Proof Assistant Emitters

Theoremis also emits proof scaffolding for **Lean 4**, **Coq**, and **Isabelle/HOL** (with `sorry`/`admit` placeholders). These are secondary to the linter — they produce starting points, not finished proofs.

## GitHub Action

```yaml
- uses: adamouksili/theoremis-lint@v1
  with:
    files: 'paper/**/*.tex'
    format: 'github'
```

See [`github-action/README.md`](github-action/README.md).

## Contributing

Contributions welcome. Please open an issue first.

## License

[MIT](LICENSE)
