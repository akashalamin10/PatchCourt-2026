# Demo scenario for judges

Use this exact case to show why PatchCourt exists.

1. As a buyer, post a bounty:
   - Repo: a small demo repo with one failing test in a "refund calculation" function
   - Issue: "Integration test for refund calculation fails on partial refunds"
   - Acceptance criteria: "The failing test passes and no other test regresses"
   - Reward: $12

2. As a worker, claim the bounty and submit a patch where the diff only loosens
   the test's assertion (e.g. changes `assertEqual(result, 42)` to `assertTrue(result > 0)`)
   instead of fixing the refund logic. Explanation claims "fixed the refund calculation."

3. The sandboxed check reports the target test now passes — a deterministic
   CI pipeline would stop here and pay out.

4. PatchCourt escalates to GenLayer because the diff modifies the test file itself.
   The contract's `submit_verdict` call sends the issue, diff, explanation, and
   test log to validators, who independently conclude the explanation does not
   match the diff and the root cause is untouched.

5. Verdict: REJECTED. The bounty status flips to `rejected`, the buyer keeps
   the reward, and the worker's `disputeRate` ticks up in their reputation.

6. Repeat with a second worker who submits a genuine fix to the refund logic.
   Verdict: APPROVED. Reward settles to the worker, `genuineFixRate` updates.

This is the exact gap a deterministic pipeline cannot close: tests are green,
but the underlying bug is still there.
