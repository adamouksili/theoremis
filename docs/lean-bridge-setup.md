# Lean Bridge Setup Guide

Set up the Theoremis Lean 4 verification bridge with full Mathlib tactic support.

## Prerequisites

| Requirement | Version | Check |
|------------|---------|-------|
| Node.js | ≥18 | `node --version` |
| Lean 4 (via elan) | ≥4.x.0 | `lean --version` |

## Step 1: Install elan + Lean 4

```bash
curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh
source ~/.profile  # or restart terminal
lean --version
```

## Step 2: Create the Mathlib Lake Project

The bridge needs a sibling Lake project with Mathlib so that `lake env lean` resolves imports:

```bash
# From the theoremis repo's parent directory:
cd /path/to/parent-of-theoremis
lake init theoremis-lean-env math

# This downloads ~8,000 Mathlib .olean files (takes 5-15 min)
cd theoremis-lean-env
lake build
```

The resulting directory structure should be:

```
parent/
  theoremis/           ← this repo
  theoremis-lean-env/  ← Lake project with Mathlib
    lakefile.toml
    lean-toolchain
    .lake/
```

You can override the path with `THEOREMIS_LEAN_PROJECT` env var.

## Step 3: Start the Bridge

```bash
cd /path/to/theoremis
npm run bridge
```

The bridge starts on port **9473**. You should see:

```
  ╔══════════════════════════════════════════╗
  ║  Theoremis Lean Bridge · port 9473       ║
  ║  POST /verify  { code, language }        ║
  ║  GET  /health                            ║
  ║  Mathlib: .../theoremis-lean-env         ║
  ╚══════════════════════════════════════════╝
```

## Step 4: Verify It Works

```bash
# Health check
curl http://localhost:9473/health
# → { "status": "ok", "lean": "...", "mathlib": true }

# Verify a proof using Mathlib tactics
curl -X POST http://localhost:9473/verify \
  -H "Content-Type: application/json" \
  -d '{"code": "import Mathlib.Tactic\nexample : 2 + 2 = 4 := by norm_num", "language": "lean4"}'
# → { "success": true, ... }
```

## Step 5: Use in the IDE

1. Open [theoremis.com](https://theoremis.com) or `npm run dev` locally
2. The status bar shows:
   - 🟢 **Lean + Mathlib** — Bridge connected with full tactic support
   - 🟢 **Lean** — Bridge connected without Mathlib
   - 🔴 **Offline** — Bridge not running
3. Click **Lean 4** button to verify emitted code

## Supported Mathlib Tactics

Once the bridge has Mathlib, these tactics work in emitted code:

| Tactic | Use Case |
|--------|----------|
| `norm_num` | Numeric computation |
| `omega` | Linear integer arithmetic |
| `ring` | Ring identities |
| `simp` | Simplification with lemma database |
| `positivity` | Positivity/nonnegativity goals |
| `linarith` | Linear arithmetic over ordered fields |

## Troubleshooting

### Port 9473 in use
```bash
lsof -ti:9473 | xargs kill -9
npm run bridge
```

### Lean not found
```bash
source ~/.zshrc  # or ~/.bashrc
which lean
lean --version
```

### Mathlib tactics fail
Make sure the Lake project built successfully:
```bash
cd /path/to/theoremis-lean-env
lake env lean --version  # should print Lean version
echo 'import Mathlib.Tactic' > Test.lean
lake env lean Test.lean   # should succeed silently
rm Test.lean
```

## Remote Access (ngrok)

To expose the bridge for the production site:

```bash
ngrok http 9473
```

Set the bridge URL at runtime instead of editing source code:

```bash
export VITE_THEOREMIS_BRIDGE_URL="https://YOUR-NGROK-URL.ngrok-free.app"
npm run build
```

For local ad-hoc testing you can still override in the browser:

```javascript
localStorage.setItem('theoremis-bridge-url', 'https://YOUR-NGROK-URL.ngrok-free.app')
```
