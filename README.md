# Theoremis

**AI-powered proof IDE for Lean 4** — parse LaTeX, detect unnecessary hypotheses via mutation testing, emit Lean 4 / Coq / Isabelle scaffolding, and verify proofs through a live Lean bridge.

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)
![CI](https://github.com/adamouksili/theoremis/actions/workflows/ci.yml/badge.svg)
![Tests](https://img.shields.io/badge/Tests-428%20passing-brightgreen?logo=vitest&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)
![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=node.js&logoColor=white)
![Lean 4](https://img.shields.io/badge/Lean_4-Bridge-blue)

**[Live Demo → theoremis.com](https://theoremis.com)** · **[Playground](https://theoremis.com/#playground)** · **[API Docs](https://theoremis.com/#api)** · **[Classroom](https://theoremis.com/#classroom)** · **[Source](https://github.com/adamouksili/theoremis)**

---

## What It Does

Theoremis reads LaTeX theorem statements and does three things:

1. **Detects unnecessary hypotheses** via mutation testing — drop each hypothesis, search for counterexamples to the weakened statement
2. **Emits proof scaffolding** for Lean 4, Coq, and Isabelle/HOL with proper imports and `sorry`/`admit` placeholders
3. **Verifies proofs** against a live Lean 4 installation through the Lean bridge

```
Input:  \begin{theorem} Let $p$ be prime and $a$ coprime to $p$. Then $a^{p-1} ≡ 1 \pmod{p}$. \end{theorem}

Output: ● p prime — necessary (dropping breaks statement: a=2, p=4 → 2³ ≡ 0 mod 4)
        ● a coprime to p — necessary (dropping breaks statement: a=3, p=3 → 3² ≡ 0 mod 3)
```

### Core Pipeline

```
LaTeX → Parser → Math-AST → λΠω IR → Type-Checker
                                          │
                     ┌────────────────────┼────────────────────┐
                     ▼                    ▼                    ▼
              Mutation Engine       Proof Emitters        Lean 4 Bridge
              (7 operators)        (Lean/Coq/Isabelle)   (live verification)
                     │                    │                    │
                     ▼                    ▼                    ▼
              BigInt Evaluator      Axiom-Tracked Code    Diagnostics
              (counterexample        with Mathlib          + Tactic
               search)                imports              Suggestions
```

## Surfaces

| Surface | URL / Command | Purpose |
|---------|--------------|---------|
| **Web IDE** | [theoremis.com/#ide](https://theoremis.com/#ide) | Full editor with axiom budget, proof steps, Lean bridge |
| **Playground** | [theoremis.com/#playground](https://theoremis.com/#playground) | Paste a theorem → see hypothesis analysis (no setup) |
| **API** | [theoremis.com/#api](https://theoremis.com/#api) | REST endpoints: parse, emit, analyze, grade |
| **Classroom** | [theoremis.com/#classroom](https://theoremis.com/#classroom) | Auto-grader for proof submissions |
| **CLI** | `npx tsx cli/lint.ts paper.tex` | Hypothesis linter (text/json/github output) |
| **VS Code Extension** | `vscode-extension/` | Verify, emit, analyze from the editor |
| **GitHub Action** | `github-action/` | CI lint for `.tex` files in pull requests |

## Benchmark Results

On our 20-theorem annotated benchmark suite (`bench/fixtures/core-theorems.tex`):

| Metric | Hypothesis Detection | Mutation Detection |
|--------|--------------------:|-------------------:|
| Precision | **100.0%** | **90.9%** |
| Recall | **100.0%** | **100.0%** |
| F1 | **100.0%** | **95.2%** |

```bash
npm run bench  # Reproduce these numbers
```

## Quick Start

```bash
git clone https://github.com/adamouksili/theoremis.git
cd theoremis
npm install

npm run dev      # Dev server → http://localhost:5173
npm run build    # Production build
npm test         # Run all 428 tests
npm run bench    # Benchmark suite with precision/recall
```

### CLI

```bash
npx tsx cli/lint.ts paper.tex              # Lint a single file
npx tsx cli/lint.ts *.tex --format json    # Machine-readable output
npx tsx cli/lint.ts *.tex --format github  # GitHub Actions annotations
```

### Lean 4 Bridge (optional)

```bash
npm run bridge   # Starts verification server on port 9473
```

Requires a local Lean 4 + Mathlib installation. See [`docs/lean-bridge-setup.md`](docs/lean-bridge-setup.md).

## Architecture

~15,000 lines of TypeScript. 428 tests. Zero runtime dependencies beyond KaTeX.

| Module | Path | Lines | Purpose |
|--------|------|------:|---------|
| **λΠω IR** | `src/core/ir.ts` | 331 | 18 term variants, universe hierarchy, axiom bundles |
| **Type-Checker** | `src/core/typechecker.ts` | 896 | Bidirectional inference, alpha-equivalence, axiom tracking |
| **Pretty Printer** | `src/core/pretty.ts` | 151 | Human-readable IR output |
| **LaTeX Parser** | `src/parser/latex.ts` | 1,220 | Recursive descent with tokenizer, ~60+ LaTeX commands |
| **Discourse Parser** | `src/parser/discourse.ts` | 165 | Rhetorical roles, dependency graphs |
| **AST Types** | `src/parser/ast.ts` | 119 | Math document & node type definitions |
| **LLM Hypothesis** | `src/parser/llm-hypothesis.ts` | 555 | AI-assisted hypothesis extraction |
| **Multi-file** | `src/parser/multifile.ts` | 152 | Cross-file theorem resolution |
| **Mutator** | `src/engine/mutator.ts` | 113 | 7 mutation operators on theorem IR |
| **Evaluator** | `src/engine/evaluator.ts` | 573 | BigInt `modPow`, domain-aware generators |
| **Counterexample** | `src/engine/counterexample.ts` | 346 | Orchestrates mutation + evaluation |
| **LLM Engine** | `src/engine/llm.ts` | 293 | Multi-provider tactic suggestions |
| **Lean 4 Emitter** | `src/emitters/lean4.ts` | 293 | Mathlib-aware emission with imports |
| **Coq Emitter** | `src/emitters/coq.ts` | 235 | Coq proof scaffolding |
| **Isabelle Emitter** | `src/emitters/isabelle.ts` | 282 | Isabelle/HOL scaffolding |
| **Lean Bridge** | `src/bridge/lean-client.ts` | 102 | Client for live verification |
| **Lean Server** | `src/bridge/lean-server.ts` | 262 | HTTP server wrapping Lean 4 CLI |
| **Mathlib DB** | `src/bridge/mathlib-db.ts` | 241 | Local Mathlib theorem database |
| **Moogle Search** | `src/bridge/moogle-search.ts` | 46 | Moogle API integration |
| **API Pipeline** | `src/api/pipeline.ts` | 185 | REST pipeline orchestration |
| **Grader** | `src/api/grader.ts` | 386 | Auto-grading engine with rubrics |
| **Serializer** | `src/api/serialize.ts` | 220 | API response serialization |
| **CLI Linter** | `cli/lint.ts` | 345 | Command-line hypothesis linter |
| **Bench Runner** | `bench/run.ts` | 239 | Precision/recall benchmark |

## Mutation Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `drop_hypothesis` | Remove a precondition entirely | Drop "p prime" from Fermat's Little |
| `weaken_condition` | Relax strict inequalities | `>` → `≥` |
| `swap_quantifier` | Exchange ∀ and ∃ | ∀n → ∃n |
| `perturb_constant` | Modify numeric constants | `p-1` → `p-2` |
| `change_domain` | Alter quantification domain | ℕ → ℤ |
| `negate_conclusion` | Flip the claimed result | `≡ 1` → `≢ 1` |
| `strengthen_conclusion` | Tighten the conclusion | `≥` → `>` |

## Limitations

- **Heuristic, not a proof.** "No counterexample found" ≠ "hypothesis is necessary." The engine tests ~500 random inputs per mutation. False negatives are possible for highly constrained domains.
- **Parser covers a subset of LaTeX.** ~60+ commands, common environments. Custom macros and unusual formatting may fail.
- **Numeric domains only.** Generators cover ℕ, ℤ, ℝ (float), Bool, Prime. Abstract algebra, topology, and measure theory are out of scope.
- **The type-checker checks well-formedness, not proof validity.** It validates IR structure, not mathematical truth.

## Research Direction

See [`docs/alignment-brief.md`](docs/alignment-brief.md) for how this technique extends to AI safety specification auditing — using mutation testing to detect unnecessary assumptions in reward models, constitutional AI rules, and formal safety properties.

## License

[MIT](LICENSE)
