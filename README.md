# Theoremis

**LaTeX → Formal Proof Scaffolding**

Write mathematics naturally in LaTeX. Get structured proof skeletons in **Lean 4**, **Coq**, and **Isabelle/HOL** — a starting point for formal verification, not a finished proof.

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![Tests](https://img.shields.io/badge/Tests-388%20passing-brightgreen)
![License](https://img.shields.io/badge/License-MIT-green)

**[Live Demo → theoremis.com](https://theoremis.com)**

## What It Does

Theoremis bridges the gap between informal mathematical writing and formal proof assistants:

1. **Parse** — Write theorems, definitions, and proofs in standard LaTeX. The parser handles common environments (`theorem`, `definition`, `lemma`, `proof`) and mathematical notation including quantifiers, set operations, modular arithmetic, and more.
2. **Formalize** — Automatic translation to a λΠω intermediate representation with axiom tracking. Each declaration records which axioms it requires (LEM, Choice, Funext, etc.).
3. **Emit** — Generate Lean 4, Coq, and Isabelle/HOL source code. Proofs contain `sorry`/`admit` placeholders where the tool cannot fill in proof terms.
4. **Test** — QuickCheck-style random testing and mutation-based counterexample search. This is **heuristic testing**, not formal verification — it validates that hypotheses are necessary, not that theorems are proven.

## Limitations

> **Honest assessment of what Theoremis does and does not do:**

- **Proofs contain `sorry` placeholders.** The tool produces proof *scaffolding*, not verified proofs. You must fill in the actual proof terms in your chosen proof assistant.
- **The parser handles a subset of LaTeX.** While coverage includes common mathematical environments and ~60+ LaTeX commands, it does not handle all valid LaTeX. Complex nested environments, custom macros, and unusual formatting may produce `Hole` (parse error) nodes.
- **Emitted code is syntactically valid but not semantically checked.** The Lean 4/Coq/Isabelle output should parse without syntax errors, but the type-checking and proof obligations are left to the target proof assistant.
- **QuickCheck testing is probabilistic.** Low pass rates on random testing often reflect constrained domains (e.g., Fermat's Little Theorem requires prime inputs), not theorem falsity.
- **LLM suggestions are best-effort.** When enabled, GPT-4o suggests tactics, but these are unverified suggestions, not proofs.

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

## Lean 4 Bridge

Theoremis includes a local verification bridge that compiles emitted Lean 4 code against **Mathlib** in real-time:

```bash
# Start the Lean bridge (requires Lean 4 + elan installed)
npm run bridge
```

The bridge runs on port 9473 and uses a sibling Lake project (`theoremis-lean-env/`) with Mathlib for full tactic support (`norm_num`, `omega`, `ring`, `simp`, `positivity`, `linarith`). See [`docs/lean-bridge-setup.md`](docs/lean-bridge-setup.md) for setup instructions.

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
