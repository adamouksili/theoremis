# Theoremis GitHub Action

Hypothesis necessity linter for LaTeX math — detects unnecessary hypotheses in theorem statements via mutation testing.

## Quick Start

```yaml
name: Lint Hypotheses
on: [push, pull_request]

jobs:
  theoremis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: adamouksili/theoremis-lint@v1
        with:
          files: 'paper.tex'
```

## Full Example

```yaml
name: Hypothesis Lint
on:
  push:
    branches: [main]
  pull_request:
    paths: ['**.tex']

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Theoremis Lint
        id: lint
        uses: adamouksili/theoremis-lint@v1
        with:
          files: 'paper/**/*.tex'
          axiom-bundle: 'ClassicalMath'
          num-tests: '1000'

      - name: Summary
        if: always()
        run: |
          echo "### Theoremis Hypothesis Lint" >> $GITHUB_STEP_SUMMARY
          echo "${{ steps.lint.outputs.report }}" >> $GITHUB_STEP_SUMMARY
```

## Inputs

| Input | Description | Default |
|---|---|---|
| `files` | Files or directories to lint | `.` |
| `axiom-bundle` | Axiom bundle name | `ClassicalMath` |
| `num-tests` | Random tests per mutation | `500` |

## Outputs

| Output | Description |
|---|---|
| `theorems` | Number of theorems analyzed |
| `unnecessary` | Number of potentially redundant hypotheses |
| `report` | Full JSON report |

## What It Does

For each `\begin{theorem}...\end{theorem}` in your LaTeX:

1. **Parse** — LaTeX → λΠω intermediate representation
2. **Mutate** — Drop each hypothesis, weaken conditions, perturb constants
3. **Test** — Search for counterexamples to the mutated statement
4. **Report** — If dropping a hypothesis produces no counterexample, it may be unnecessary

Annotations appear inline in your PR as GitHub warning annotations.
