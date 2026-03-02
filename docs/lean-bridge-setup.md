# Lean Bridge Setup Guide

This guide explains how to connect Theoremis's IDE to a local Lean 4 installation for real-time verification feedback.

## Prerequisites

| Requirement | Version | Check |
|------------|---------|-------|
| Node.js | ≥18 | `node --version` |
| Lean 4 (via elan) | ≥4.x.0 | `lean --version` |
| Mathlib | latest | `lake build` in project |

## Step 1: Install elan + Lean 4

```bash
# Install elan (Lean's version manager — like rustup for Lean)
curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh

# Verify installation
source ~/.profile  # or restart terminal
lean --version
# Expected: leanprover/lean4:v4.x.0
```

## Step 2: Create a Lean 4 Project (Optional)

If you want Mathlib support for the bridge, create a Lean project:

```bash
# Create a new Lean 4 project with Mathlib
mkdir -p ~/lean-workspace && cd ~/lean-workspace
lake init MyProject math
lake build  # This takes 15-30 minutes the first time (downloads Mathlib)
```

## Step 3: Start the Bridge Server

```bash
# In the Theoremis project root:
npm run bridge
```

This starts the Lean language server bridge on `localhost:3100`. The IDE will automatically connect when it detects the bridge is running.

## Step 4: Use in the IDE

1. Open [theoremis.com](https://theoremis.com) or run `npm run dev` locally
2. Click **Open IDE**
3. The status indicator in the top bar will show:
   - 🔴 **Offline** — Bridge not running
   - 🟢 **Connected** — Bridge active, Lean verification available
4. Write or paste Lean 4 code → see real diagnostics inline

## Troubleshooting

### Bridge won't start
```bash
# Ensure tsx is available
npx tsx --version

# Check if port 3100 is in use
lsof -i :3100
```

### Lean not found
```bash
# Re-source your shell profile
source ~/.bashrc  # or ~/.zshrc on macOS

# Verify elan is installed
which elan
which lean
```

### Mathlib import errors
```bash
# Update Mathlib to latest
cd ~/lean-workspace
lake update
lake build
```

## Architecture

```
Browser (theoremis.com)
    ↕ WebSocket
Lean Bridge Server (localhost:3100)
    ↕ stdio
Lean 4 Language Server (lean --server)
    ↕ 
Lean Toolchain + Mathlib
```

The bridge acts as a WebSocket-to-stdio proxy between the browser and the Lean 4 language server. It manages file sessions and routes diagnostics back to the IDE.
