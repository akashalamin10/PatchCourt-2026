# Free-tier AI judging pipeline (no Firebase Blaze plan needed)

Replaces the Cloud Functions pipeline with three free services:

```
Frontend (submit patch)
  -> Cloudflare Worker   (cloudflare-worker.js)      -- holds the GitHub token
  -> GitHub Actions      (.github/workflows/judge.yml) -- fetches the diff
  -> judge.js            (this folder)                -- asks GenLayer to
                                                           judge it, writes the
                                                           verdict straight to
                                                           Firestore with a
                                                           service account
                                                           (bypasses security
                                                           rules, same as the
                                                           old Cloud Function)
```

## Why not call GenLayer directly from the browser (no backend at all)?

Some GenLayer demo projects (e.g. the AgentDeal hackathon reference) show a
frontend that calls `genlayer-js` straight from the page, with no backend.
It's a nice pattern, but two things make it unsafe/unproven for this project:

1. A contract write needs a *funded* account to sign it. Either every visitor
   needs their own funded testnet wallet (bad UX, faucet friction), or you'd
   have to embed one shared private key in public frontend JS -- which
   anyone can copy out of the page source and use to spam or drain your
   contract. That's not something to ship.
2. `genlayer-js` is a Node-oriented SDK. Its own reference demo never
   actually loads it in the browser or sets a live contract address -- the
   public version of that demo always runs in a simulated/fake mode. Whether
   it truly works bundled for a browser, or inside a Cloudflare Worker's
   isolate, isn't confirmed anywhere.

So the private key that can sign transactions stays server-side (as a
GitHub/Cloudflare secret), inside a real Node.js runtime (GitHub Actions)
where `genlayer-js` is known to work (the original functions/ folder already
depended on it the same way).

## Why there's no `npm install && npm test` step anymore

An earlier version of this pipeline cloned the submitted repo and ran
`npm test` inside GitHub Actions, mirroring the original Cloud Function.
That only works for Node.js projects with a working test script, and breaks
for anything else. Following the same idea AgentDeal uses -- let the AI
validators judge the *evidence* (the diff + the worker's explanation)
instead of trying to re-execute the work -- `judge.js` now just fetches the
pull request diff via GitHub's API and passes it straight to GenLayer's
`submit_verdict`. Simpler, and it works for any language/stack.

## Setup checklist

1. **GitHub repo secrets** (Settings -> Secrets and variables -> Actions):
   - `FIREBASE_SERVICE_ACCOUNT` -- paste the whole service-account JSON (Firebase Console -> Project settings -> Service accounts -> Generate new private key).
   - `GENLAYER_CONTRACT_ADDRESS` -- your contract's address after deploying it on GenLayer Studio (studio.genlayer.com).
   - `GENLAYER_RPC_URL` -- only needed for a custom/self-hosted GenLayer node. Leave it empty (create it with a blank value, or skip it) to use StudioNet's default endpoint.
   (`GITHUB_TOKEN` used inside the workflow to fetch the diff is provided
   automatically by GitHub Actions -- you don't need to create that one.
   GenLayer itself doesn't need a stored private key either -- `judge.js`
   generates a fresh throwaway signing account on every run, the same way
   the AgentDeal demo does.)
3. **A separate GitHub personal access token** (fine-grained, this repo
   only, permission: "Contents: read" + "Actions: read and write") -- this
   is only used by the Cloudflare Worker to *trigger* the workflow.
4. **Cloudflare Worker**: dash.cloudflare.com (free account) -> Workers &
   Pages -> Create Worker -> paste `cloudflare-worker.js` -> Settings ->
   Variables and Secrets -> add `GITHUB_TOKEN` (the token from step 3,
   encrypted), `GITHUB_OWNER`, `GITHUB_REPO` -> Deploy. Copy the
   `*.workers.dev` URL it gives you.
5. Paste that URL into `public/js/config/pipeline-config.js` as `WORKER_URL`.
6. Redeploy hosting: `firebase deploy --only hosting`.

If `WORKER_URL` is left empty, nothing breaks -- submissions just stay on the
manual Approve/Reject flow (bounty-detail.html).
