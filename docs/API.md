# PatchCourt — Internal API Reference

## Frontend modules (`public/js/modules/`)

### auth.js
- `signUp(name, email, password, role)`
- `logIn(email, password)`
- `signInWithGoogle(defaultRole)`
- `logOut()`
- `watchAuth(callback)`
- `getUserProfile(uid)`
- `updateUserName(user, name)`

### bounty.js
- `createBounty(buyerId, data)`
- `getBounty(bountyId)`
- `watchBuyerBounties(buyerId, callback)`
- `watchWorkerBounties(workerId, callback)`
- `watchOpenBounties(callback)`
- `claimBounty(bountyId, workerId)`
- `markUnderReview(bountyId)`

### submission.js
- `createSubmission(bountyId, workerId, data)`
- `watchSubmissionsByWorker(workerId, callback)`
- `watchSubmissionsByBounty(bountyId, callback)`

### dispute.js
- `createDispute(bountyId, raisedBy, reason, notes)`
- `watchDisputesByUser(uid, callback)`

## Cloud Function (`functions/index.js`)

### onSubmissionCreated
Firestore trigger on `submissions/{submissionId}` create.
1. Runs `runInSandbox(repoUrl, branchLink)`.
2. Calls `resolveVerdict(bounty, submission, testResult)` — auto-approves a clean pass, otherwise asks the GenLayer contract.
3. Updates the bounty status, the submission verdict, and the worker's reputation.

## GenLayer contract (`contracts/patch_court_contract.py`)

- `post_bounty(bounty_id, repo_url, issue_description, reward, acceptance_criteria)`
- `claim_bounty(bounty_id, worker_address)`
- `submit_verdict(bounty_id, diff_text, explanation, test_log)` — returns `APPROVED` / `REJECTED` / `PARTIAL`
- `get_bounty(bounty_id)` — view method
- `list_bounty_ids()` — view method
