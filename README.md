# PatchCourt

Trustless, AI-judged escrow for verified code fixes, built on GenLayer.

A buyer posts a bounty against a real bug. A worker submits a patch. When the
automated test result is a clean pass, the bounty settles immediately. When
it's ambiguous — the test passes but the diff looks like it games the
assertion instead of fixing the bug — GenLayer's validators read the issue,
diff, and logs and reach a judged verdict under the Equivalence Principle.

Developed by [@Xu22uX](https://x.com/Xu22uX) for the GenLayer Agent Tank hackathon.

---

## 1. What's in this repo

```
public/          Frontend (vanilla HTML/CSS/JS, Firebase Hosting)
functions/       Firebase Cloud Functions (sandboxed test runner, GenLayer bridge, reputation)
contracts/       GenLayer Intelligent Contract (Python) + tests
docs/            Architecture, API reference, demo scenario
firestore.rules / firestore.indexes.json / storage.rules
firebase.json / .firebaserc
```

## 2. Prerequisites

- Node.js 18+
- Python 3.10+ (for the contract and its tests)
- A free [Firebase](https://console.firebase.google.com) account
- A free [GenLayer](https://genlayer.com) testnet wallet + faucet tokens
- Docker (only needed if you run GenLayer Studio locally)

## 3. Firebase setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Authentication** → sign-in methods: **Email/Password** and **Google**.
3. Enable **Firestore Database** (production mode).
4. Enable **Hosting**.
5. In Project Settings → General, copy your web app config object.
6. Paste it into `public/js/config/firebase-config.js`:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

7. Update `.firebaserc` with your project ID:

```json
{ "projects": { "default": "your-firebase-project-id" } }
```

8. Install the Firebase CLI and log in:

```bash
npm install -g firebase-tools
firebase login
```

9. Deploy security rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 4. Run the frontend locally

```bash
firebase serve --only hosting
```

Open the printed local URL. Sign up, pick a role (Buyer/Worker), and try the
flow — posting a bounty, claiming it, submitting a patch.

## 5. Deploy the frontend live (free)

```bash
firebase deploy --only hosting
```

You'll get a live URL like `https://your-project-id.web.app`.

## 6. Cloud Functions (sandboxed test runner + GenLayer bridge)

```bash
cd functions
npm install
```

Set the environment variables the functions need (Firebase Functions v2 uses
`.env` files in the `functions/` folder — copy `.env.example` from the repo
root into `functions/.env` and fill in):

```
GENLAYER_NETWORK=testnet
GENLAYER_RPC_URL=<your GenLayer testnet RPC endpoint>
GENLAYER_CONTRACT_ADDRESS=<deployed contract address, step 8>
GITHUB_TOKEN=<a GitHub personal access token, if using real repos>
```

Deploy:

```bash
firebase deploy --only functions
```

## 7. GenLayer Intelligent Contract

### Local iteration (GenLayer Studio)

```bash
npm install -g genlayer
genlayer init
```

This starts GenLayer Studio (Docker required) at `http://localhost:8080`.
Paste the contents of `contracts/patch_court_contract.py` into a new contract,
deploy it locally, and call `post_bounty` / `claim_bounty` / `submit_verdict`
from the Studio UI to see validator consensus in action.

When Studio asks for an LLM provider, choose **Ollama** for a fully free
setup (no API key), or **OpenAI** if you already have a key.

### Deploy to testnet (Asimov)

1. Get a wallet and testnet GEN from the official GenLayer faucet.
2. Deploy `contracts/patch_court_contract.py` to testnet using the GenLayer
   CLI or Studio's testnet mode.
3. Copy the deployed contract address into `GENLAYER_CONTRACT_ADDRESS` (used
   by both the Cloud Functions and, if you wire it in, the frontend).

### Contract tests

```bash
cd contracts
pip install pytest --break-system-packages
python -m pytest tests/ -q
```

## 8. Images

Drop these files into the named folders — no code changes needed, they're
already referenced everywhere:

- `public/assets/images/genlayer-logo.png`
- `public/assets/images/favicon.ico`
- `public/assets/images/hero-bg.jpg`
- `public/assets/images/icons/x-icon.svg`
- `public/assets/images/icons/telegram-icon.svg`
- `public/assets/images/icons/discord-icon.svg`
- `public/assets/images/icons/github-icon.svg`

## 9. Demo scenario for judges

See `docs/DEMO_SCENARIO.md` for the exact test-gaming case that shows why
PatchCourt needs GenLayer instead of a plain CI pipeline.

## 10. Continuous deployment (optional)

`.github/workflows/deploy.yml` redeploys Hosting on every push to `main`.
Add a `FIREBASE_TOKEN` secret to the GitHub repo (`firebase login:ci` to
generate one) for this to work.

## License

© All Rights Reserved GenLayer. Built by [@Xu22uX](https://x.com/Xu22uX).
