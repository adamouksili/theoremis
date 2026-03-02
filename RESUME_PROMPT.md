# Context & Current State
We are working on **Theoremis**, an AI-powered proof IDE for Lean 4. The frontend runs on React/Vite and is deployed live on Vercel at `theoremis.com`. 

The web app requires a "Lean Bridge" — a backend Node.js server (`src/bridge/lean-server.ts`) that runs the actual Lean 4 compiler to verify proofs. Because Lean 4 is computationally heavy, we are currently running the Lean Bridge **locally on an M4 Pro MacBook** and exposing it to the live production site via an **ngrok tunnel**.

### What we just finished:
1. Installed Lean 4 (`leanprover/lean4:stable`) natively on the Mac.
2. Started the bridge server on port `9473`.
3. Set up an `ngrok` tunnel to expose port 9473 to the internet.
4. Pointed the live site to the ngrok URL (`https://diamagnetic-preauricular-andree.ngrok-free.dev`) using `localStorage.setItem('theoremis-bridge-url', '<ngrok-url>')`.
5. **The CORS Fix:** We noticed the connection was failing because ngrok's free tier intercepts the first request with an HTML "Visit Site" warning. The frontend tried to bypass this using the `ngrok-skip-browser-warning: true` header, but the server rejected it during the preflight (OPTIONS) check. I pushed a fix to `src/bridge/lean-server.ts` to include `ngrok-skip-browser-warning` in the `Access-Control-Allow-Headers`.

### Current Blocker / Immediate Next Step:
When attempting to restart the local `npm run bridge` server to apply the CORS fix, it threw an `EADDRINUSE: address already in use :::9473` error because the old server process is still lingering in the background.

### Your Task:
1. Help me kill the lingering Node process on port 9473.
2. Start the bridge server clean using `npm run bridge`.
3. Ensure the ngrok tunnel is alive and note its URL.
4. Guide me to open `theoremis.com`, set the new ngrok URL in localStorage, and verify that the UI Bridge Status indicator flips from "● Offline" to "● Online".
5. Have me run a live formal verification on `theoremis.com` using the "Verify" button to completely validate that the local bridge is flawlessly executing live proofs from the production site.
6. Once verified, outline what our next milestone should be for making this startup ready for real users.
