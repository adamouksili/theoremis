# Theoremis

**Formal Verification, Democratized**

Write mathematics naturally in LaTeX. Get verified formal proofs in **Lean 4**, **Coq**, and **Isabelle/HOL**.

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Alpha-orange)

## What It Does

Theoremis bridges the gap between informal mathematical writing and machine-verified formal logic:

1. **Parse** — Write theorems, definitions, and proofs in standard LaTeX
2. **Formalize** — Automatic translation to a λΠω intermediate representation with axiom tracking
3. **Emit** — Generate valid Lean 4, Coq, and Isabelle/HOL source code
4. **Verify** — QuickCheck-style random testing and counterexample mutation search

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

Then open [http://localhost:5173](http://localhost:5173) and paste your LaTeX.

## Architecture

```
LaTeX Input → Parser → Math-AST → λΠω IR → Type-Checker
                                       ↓
                              ┌────────┼────────┐
                              ▼        ▼        ▼
                           Lean 4    Coq    Isabelle
                              ↓
                        QuickCheck Testing
                        Mutation Analysis
```

### Modules

| Module | Path | Purpose |
|--------|------|---------|
| **Core** | `src/core/` | λΠω IR types, type-checker, pretty-printer |
| **Parser** | `src/parser/` | LaTeX → Math-AST, discourse analysis |
| **Emitters** | `src/emitters/` | IR → Lean 4 / Coq / Isabelle code generation |
| **Engine** | `src/engine/` | QuickCheck evaluator, counterexample search, mutation |
| **IDE** | `src/ide/` | Browser-based IDE with axiom budget, proof steps, lens |

## Features

- **Axiom Budget Sidebar** — Toggle LEM, Choice, Funext, Propext, Quotient, Univalence
- **Multi-Backend Output** — Lean 4 (Mathlib), Coq (Gallina), Isabelle/HOL
- **Notation Lens** — Click any declaration to see its IR and backend code
- **Proof Step Viewer** — Tactic-by-tactic proof display with ghost suggestions
- **Counterexample Insights** — Mutation testing to validate hypothesis necessity
- **QuickCheck Random Testing** — Property-based testing of theorem statements

## Example

```latex
\begin{theorem}[Fermat's Little Theorem]
Let $p$ be a prime number and $a$ an integer coprime to $p$.
Then $a^{p-1} \equiv 1 \pmod{p}$.
\end{theorem}

\begin{proof}
We proceed by induction on $a$. Consider the set $\{1, 2, \ldots, p-1\}$.
Since $a$ is coprime to $p$, multiplication by $a$ modulo $p$ is a bijection.
\end{proof}
```

## VS Code Extension (Preview)

A scaffolded VS Code extension lives in `vscode-extension/`. It registers commands for verifying LaTeX documents via the Lean bridge and emitting formal code. **Status: preview / not yet published.**

```bash
cd vscode-extension
npm install
npm run compile
# Then press F5 in VS Code to launch an Extension Development Host
```

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)
