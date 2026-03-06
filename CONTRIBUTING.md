# Contributing to Theoremis

Thank you for your interest in contributing to Theoremis! We welcome contributions from the community, especially from the Lean 4 and formal verification communities.

## Open-Core Model

Theoremis uses an **open-core model**:

| Open Source (this repo, MIT) | Cloud Platform (theoremis.com) |
|---|---|
| Parser, type-checker, IR | Managed verification workers |
| Emitters (Lean 4 / Coq / Isabelle) | User accounts + proof storage |
| Mutation engine + evaluator | Team workspaces + classroom analytics |
| CLI + VS Code extension | Priority queue infrastructure |
| Core API handlers | AI model fine-tuning |

Contributions to the open-source core are always welcome.

## Getting Started

```bash
git clone https://github.com/adamouksili/theoremis.git
cd theoremis
npm install
npm run dev      # Dev server at http://localhost:5173
npm test         # 467 tests
npm run lint     # ESLint
npm run format   # Prettier
```

## What to Contribute

**High-impact areas:**
- 🧮 **Lean 4 emitter improvements** — Better Mathlib import detection, tactic generation
- 🔬 **New mutation operators** — Extend the 7 existing operators
- 📐 **LaTeX parser coverage** — Support for more commands and environments
- 🧪 **Test cases** — New theorem fixtures with ground-truth annotations
- 🐛 **Bug reports** — Especially edge cases in parsing or type-checking
- 📖 **Documentation** — Tutorials, examples, API usage guides

**Before you start:**
1. Check existing [issues](https://github.com/adamouksili/theoremis/issues) for duplicates
2. Open an issue describing your proposed change before large PRs
3. Keep PRs focused — one feature or fix per PR

## Code Standards

- **TypeScript** — All source code in `src/` is TypeScript
- **ESLint + Prettier** — Run `npm run lint` and `npm run format` before committing
- **Tests** — Add tests for new functionality. Run `npm test` to verify
- **Type-check** — Run `npx tsc --noEmit` to catch type errors

## Pull Request Process

1. Fork the repository and create a feature branch
2. Make your changes with tests
3. Ensure `npm test`, `npm run lint`, and `npx tsc --noEmit` all pass
4. Submit a PR with a clear description of what changed and why
5. A maintainer will review within 48 hours

## Commit Messages

Use conventional commit format:
```
feat: add support for \mathbb command in parser
fix: handle edge case in BigInt modular exponentiation
docs: update API endpoint documentation
test: add fixture for Cauchy-Schwarz inequality
```

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
