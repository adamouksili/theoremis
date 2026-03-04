# Theoremis

**Lean-first formal verification IDE** — verify Lean 4 proofs with kernel-truth semantics, with LaTeX translation and heuristic analysis kept as advisory tooling.

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)
![CI](https://github.com/adamouksili/theoremis/actions/workflows/ci.yml/badge.svg)
![Tests](https://img.shields.io/badge/Tests-467%20passing-brightgreen?logo=vitest&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)
![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=node.js&logoColor=white)
![Lean 4](https://img.shields.io/badge/Lean_4-Bridge-blue)

**[Live Demo → theoremis.com](https://theoremis.com)** · **[Playground](https://theoremis.com/#playground)** · **[API Docs](https://theoremis.com/#api)** · **[Classroom](https://theoremis.com/#classroom)** · **[Source](https://github.com/adamouksili/theoremis)**

---

## What It Does

Theoremis now has a formal-first product split:

1. **Formal verification (`/api/v2/verify`)** via Lean kernel checks in isolated worker jobs
2. **Draft translation (`/api/v2/translate/latex`)** for LaTeX to Lean generation (explicitly non-verified)
3. **Legacy analysis (`/api/v1/*`)** for mutation/randomized heuristics, clearly labeled as non-formal

```
Input:  \begin{theorem} Let $p$ be prime and $a$ coprime to $p$. Then $a^{p-1} ≡ 1 \pmod{p}$. \end{theorem}

Output: ● p prime — necessary (dropping breaks statement: a=2, p=4 → 2³ ≡ 0 mod 4)
        ● a coprime to p — necessary (dropping breaks statement: a=3, p=3 → 3² ≡ 0 mod 3)
```

### Core Pipeline

```
Lean Source → /api/v2/verify → Queue/Worker Sandbox → lake env lean
                                                 │
                                                 ▼
                                   Kernel diagnostics + obligations gate
                                                 │
                                                 ▼
                                   verified=true only when all gates pass

LaTeX Source → /api/v2/translate/latex → Lean draft (advisory only)
LaTeX Source → /api/v1/*               → Legacy analysis (non-formal)
```

## Surfaces

| Surface | URL / Command | Purpose |
|---------|--------------|---------|
| **Web IDE** | [theoremis.com/#ide](https://theoremis.com/#ide) | Lean-first editor with formal verification status badges |
| **Playground** | [theoremis.com/#playground](https://theoremis.com/#playground) | Paste a theorem → see hypothesis analysis (no setup) |
| **API** | [theoremis.com/#api](https://theoremis.com/#api) | v2 formal verify/jobs/translation + legacy v1 analysis |
| **Classroom** | [theoremis.com/#classroom](https://theoremis.com/#classroom) | Auto-grader for proof submissions |
| **CLI** | `npx tsx cli/lint.ts paper.tex` | Hypothesis linter (text/json/github output) |
| **VS Code Extension** | `vscode-extension/` | Verify, emit, analyze from the editor |
| **GitHub Action** | `github-action/` | CI lint for `.tex` files in pull requests |

## Benchmark Results

Benchmarks are now split into:
- Internal suite: `bench/fixtures/internal/`
- Holdout suite: `bench/fixtures/holdout/` (with provenance metadata)

Latest aggregate run:

| Metric | Hypothesis Detection | Mutation Detection |
|--------|--------------------:|-------------------:|
| Precision | **100.0%** | **93.3%** |
| Recall | **100.0%** | **100.0%** |
| F1 | **100.0%** | **96.6%** |

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
npm test         # Run all tests
npm run bench    # Benchmark suite with precision/recall
npm run perf     # Deterministic runtime harness (median-based)
npm run size:check # Enforce bundle/dist size budgets
```

### CLI

```bash
npx tsx cli/lint.ts paper.tex              # Lint a single file
npx tsx cli/lint.ts *.tex --format json    # Machine-readable output
npx tsx cli/lint.ts *.tex --format github  # GitHub Actions annotations
```

### Lean 4 Bridge (optional, legacy IDE helper)

```bash
npm run bridge   # Starts verification server on port 9473
```

This bridge is advisory tooling for local workflows. Formal verification truth is provided by `/api/v2/verify`.
Requires a local Lean 4 + Mathlib installation. See [`docs/lean-bridge-setup.md`](docs/lean-bridge-setup.md).

## Performance & Size Budgets

Theoremis includes CI-enforced optimization gates:

- `npm run perf:ci` checks runtime budgets from `bench/perf-budget.json` using median + p90 sampling, CI jitter tolerance, and baseline drift checks
- `npm run size:check` checks entry JS/CSS and runtime `dist/` budgets (excluding social metadata images)
- Perf reports are emitted to `bench/artifacts/perf-report.json`

Use these locally before pushing performance-sensitive changes:

```bash
npm run build
npm run perf
npm run perf:ci
npm run size:check
```

## Security & Deployment Env Vars

Runtime and deployment settings are environment-driven:

- `VITE_THEOREMIS_BRIDGE_URL` — default Lean bridge URL used by the web client
- `THEOREMIS_API_KEYS` — comma-separated valid API keys for API endpoints (required in production)
- `THEOREMIS_ALLOWED_ORIGINS` — comma-separated CORS allowlist for API endpoints
- `THEOREMIS_REDIS_URL` — Redis REST endpoint used for distributed sliding-window rate limits
- `THEOREMIS_REDIS_TOKEN` — Redis auth token
- `THEOREMIS_RATE_LIMIT_WINDOW_SEC` — window size for rate limiting (seconds)
- `THEOREMIS_RATE_LIMIT_FREE` — free-tier request budget per window
- `THEOREMIS_RATE_LIMIT_PRO` — pro-tier request budget per window
- `THEOREMIS_LEAN_PROJECT` — path to local/sibling Lean + Mathlib Lake project
- `THEOREMIS_V2_VERIFY_ENABLED` — enable/disable `/api/v2/verify`
- `THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE` — allow in-memory formal queue runtime (must be explicit in production)
- `THEOREMIS_V2_QUEUE_CONCURRENCY` — concurrent formal workers
- `THEOREMIS_V2_MAX_FILES` / `THEOREMIS_V2_MAX_FILE_BYTES` / `THEOREMIS_V2_MAX_TOTAL_BYTES` — formal request size limits
- `THEOREMIS_V2_MIN_TIMEOUT_MS` / `THEOREMIS_V2_MAX_TIMEOUT_MS` — formal timeout clamp
- `THEOREMIS_V2_MIN_MEMORY_MB` / `THEOREMIS_V2_MAX_MEMORY_MB` — formal memory clamp

API request bodies for `/api/v1/parse`, `/api/v1/analyze`, `/api/v1/pipeline`, and `/api/v1/grade` accept:
- `typeCheckMode: "permissive" | "strict"`

Analyze and pipeline requests additionally accept:
- `timeoutMs` and `maxWorkItems` guardrails

Analyze responses now include additive metadata:
- `truncated: boolean` (+ `truncationReason` when limits trigger)
- `strictDiagnostics` when strict mode is active

Legacy endpoints `/api/v1/analyze` and `/api/v1/pipeline` include:
- `X-Theoremis-Legacy: true`
- response `mode: "legacy-analysis"`

Deployment details: see [`docs/api-hardening.md`](docs/api-hardening.md).

## Architecture

~15,000 lines of TypeScript. 467 tests. Zero runtime dependencies beyond KaTeX.

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

- **Formal verification is Lean-only in v2.** Coq/Isabelle remain translation targets; they are not pass/fail backends.
- **Heuristic analysis is non-sound by design.** "No counterexample found" ≠ "proof." Legacy analysis is advisory only.
- **Parser covers a subset of LaTeX.** ~60+ commands, common environments. Custom macros and unusual formatting may fail.
- **Numeric domains only.** Generators cover ℕ, ℤ, ℝ (float), Bool, Prime. Abstract algebra, topology, and measure theory are out of scope.
- **Formal runtime dependencies are required.** Production verification fails closed if queue/checker runtime requirements are missing.

## Research Direction

See [`docs/alignment-brief.md`](docs/alignment-brief.md) for how this technique extends to AI safety specification auditing — using mutation testing to detect unnecessary assumptions in reward models, constitutional AI rules, and formal safety properties.

## License

[MIT](LICENSE)
