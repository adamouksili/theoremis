<p align="center">
  <img src="public/logo_transparent.png" alt="Theoremis" height="64" />
</p>

<h1 align="center">Theoremis</h1>

<p align="center">
  <strong>Formal verification services, accelerated by tooling.</strong><br/>
  We help teams formalize critical guarantees and ship machine-checked results faster.
</p>

<p align="center">
  <a href="https://theoremis.com">Website</a> ·
  <a href="https://theoremis.com/#pricing">Services</a> ·
  <a href="https://theoremis.com/#ide">IDE</a> ·
  <a href="https://theoremis.com/#playground">Playground</a> ·
  <a href="https://theoremis.com/#api">API</a> ·
  <a href="https://theoremis.com/#changelog">Changelog</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/v1.0.0-stable-brightgreen" alt="Version" />
  <img src="https://img.shields.io/badge/Tests-467%20passing-brightgreen?logo=vitest&logoColor=white" alt="Tests" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Lean_4-Bridge-blue" alt="Lean 4" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## What is Theoremis?

Theoremis is a formal verification startup. We deliver services that help teams scope verification work, formalize specifications, and implement Lean 4 proofs with production-ready workflows.

This repository contains the open-source acceleration stack we use in those engagements: LaTeX parsing, mutation-based hypothesis testing, code emission, and Lean 4 verification orchestration.

```
Scope high-risk properties → Formalize specs → Prove in Lean 4 → Integrate into CI
```

### Key Features

- **Verification Delivery** — Scoped formal verification audits and implementation sprints
- **Lean 4 Kernel Truth** — Machine-checked verification with obligation accounting
- **Hypothesis Testing** — QuickCheck-style mutation analysis with 7 operators
- **Workflow Integration** — API and CI-friendly verification pipeline
- **Open Tooling** — Parser, emitters, and bridge infrastructure under MIT license

## Surfaces

| Surface | URL | Purpose |
|---------|-----|---------|
| **Services** | [theoremis.com/#pricing](https://theoremis.com/#pricing) | Engagement models for audit, sprint, and embedded verification |
| **Web IDE** | [theoremis.com/#ide](https://theoremis.com/#ide) | Full editor with verification, axiom tracking, dependency graph |
| **Playground** | [theoremis.com/#playground](https://theoremis.com/#playground) | Quick theorem analysis — no setup |
| **API** | [theoremis.com/#api](https://theoremis.com/#api) | REST endpoints for verification + translation |
| **CLI** | `npx tsx cli/lint.ts` | Hypothesis linter for `.tex` files |
| **VS Code** | `vscode-extension/` | Editor integration |
| **GitHub Action** | `github-action/` | CI gate for `.tex` PRs |

## Quick Start

```bash
git clone https://github.com/adamouksili/theoremis.git
cd theoremis
npm install

npm run dev      # Dev server → http://localhost:5173
npm test         # 467 tests
npm run bench    # Benchmark suite with precision/recall
```

## Operating Model

Theoremis runs as a services-first company. Client engagements drive roadmap priorities, while this MIT-licensed codebase remains the reusable core used to accelerate delivery.

| Open Source Core (MIT) | Services Layer (Theoremis) |
|---|---|
| Parser, type-checker, IR | Verification audits and planning |
| Lean bridge + verification queue | Proof engineering implementation |
| Emitters (Lean 4 / Coq / Isabelle) | CI integration and release gates |
| Mutation engine + evaluator | Team enablement and onboarding |
| CLI + VS Code extension | Ongoing embedded verification support |

> Contact: **adam@theoremis.com**

## Architecture

~15,000 lines of TypeScript. 467 tests. Zero runtime dependencies beyond KaTeX.

```
src/
├── core/         # λΠω IR (18 term variants), type-checker, axiom tracking
├── parser/       # LaTeX recursive descent, LLM hypothesis extraction
├── engine/       # Mutation operators, BigInt evaluator, counterexample generator
├── emitters/     # Lean 4 (Mathlib-aware), Coq, Isabelle/HOL
├── formal/       # Lean bridge, verification queue, obligation counter
├── bridge/       # Lean server, Mathlib DB, Moogle search
├── api/          # Pipeline orchestration, grading, serialization
├── ide/          # Web IDE, landing, playground, classroom, pricing, changelog
└── styles/       # CSS design system
```

## Benchmark

| Metric | Hypothesis Detection | Mutation Detection |
|--------|--------------------:|-------------------:|
| Precision | **100.0%** | **93.3%** |
| Recall | **100.0%** | **100.0%** |
| F1 | **100.0%** | **96.6%** |

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**High-impact areas:** Lean 4 emitter improvements, new mutation operators, LaTeX parser coverage, test fixtures, documentation.

## Security

Found a vulnerability? Please email **adam@theoremis.com** instead of opening a public issue. See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) — free forever for the open-source core.

---

<p align="center">
  Built by <a href="https://github.com/adamouksili">Adam Ouksili</a> · Theoremis Formal Verification Services
</p>
