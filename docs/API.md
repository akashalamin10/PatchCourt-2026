# PatchCourt — Internal API Reference

## Frontend modules (`public/js/`)

### wallet.js
- `connectWallet()` — prompts the browser wallet, returns the connected address
- `getAccount()` — returns the currently connected address, or empty if none
- `shortAddr(address)` — formats an address for display

### genlayer-client.js
- `readContract(functionName, args)` — calls a `@gl.public.view` method
- `writeContract(functionName, args, account, value?)` — calls a `@gl.public.write` method, optionally sending native value for payable methods
- `listBountyIds()` — convenience wrapper around `list_bounty_ids`
- `getBounty(bountyId)` — convenience wrapper around `get_bounty`, parses the JSON result
- `getCredit(address)` — convenience wrapper around `get_credit`

### ui.js
- `pageShell(options)` / `pageFooter()` — shared nav/footer markup
- `toast(message, kind)` — single-instance toast notification
- `withSpinner(button, task)` — disables a button and shows a spinner while `task` runs
- `pageLoader(container, message)` — renders a spinner row while data loads
- `formValue(form, name)`, `rememberBountyId(id)`, `loadLocalBountyIds()`, `statusClass(status)`

## GenLayer contract (`contracts/patch_court_contract.py`)

- `post_bounty(bounty_id, repo_url, issue_description, reward, acceptance_criteria)` — payable; caller must send `value == reward`
- `claim_bounty(bounty_id)` — caller becomes the worker; buyer cannot claim their own bounty
- `submit_patch(bounty_id, diff_text, explanation, test_log)` — worker only
- `submit_verdict(bounty_id)` — runs the AI judge across validators (Equivalence Principle), settles or rejects, credits the escrow split
- `raise_dispute(bounty_id, notes)` — buyer or worker only, on a settled/rejected case
- `withdraw()` — pays out the caller's accumulated credit balance
- `get_bounty(bounty_id)` — view, returns the bounty record as JSON
- `list_bounty_ids()` — view, returns all bounty ids as a JSON array
- `get_credit(address)` — view, returns an address's withdrawable balance
- `get_owner()` — view, returns the deploying address

There is no off-chain API, database, or backend. Every read and write above goes straight to the contract on Studio Next.
