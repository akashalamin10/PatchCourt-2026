# Test Patch Court — Even or Odd Bounty

Second live PatchCourt test. The buyer asked for a small program that tells whether a user-entered integer is even or odd. The worker submitted a GitHub pull request. GenLayer judged the work on-chain.

This write-up is only about that bounty, not the earlier README-only test.

---

## 1. Setup reused from the first test

Nothing new was deployed for this round.

| Piece | Value |
| --- | --- |
| Live site | PatchCourt (buyer + worker accounts already created) |
| Buyer GitHub | `akashalamin10` |
| Worker GitHub | `AKASH281221` |
| Buyer wallet | `0x8f4f...4d48` |
| Worker wallet | `0xa671...ce37` |
| Repo | https://github.com/akashalamin10/patchcourt-test |
| Worker fork | https://github.com/AKASH281221/patchcourt-test |
| Cloudflare Worker | https://patchcourt-trigger.akash-alamin-cse.workers.dev |
| GenLayer contract | `0xF91574fbC770c28F9331c03C5C83D4C172b9b630` |

Two browsers again: buyer in one, worker in the other.

---

## 2. What the buyer posted

Dashboard → **Post a bounty**.

| Field | Value entered |
| --- | --- |
| Repo | `https://github.com/akashalamin10/patchcourt-test` |
| Issue / description | See below |
| Reward | `$30` |
| Deadline | `5 hours` |
| Acceptance criteria | See below |

### Issue description (paste)

```
Check whether a user-entered integer is even or odd.

Add a small program in this repo that reads one integer from the user (CLI argument or stdin) and prints whether that number is even or odd.
```

### Acceptance criteria (paste)

```
1. There is a runnable program file in the repo (for example even-odd.js or even_odd.py).
2. Running it with an integer input prints that the number is even or odd.
3. Example: input 7 prints that 7 is odd; input 4 prints that 4 is even.
4. Non-integer input is rejected with a clear error, not treated as even/odd.
5. README explains how to run the program in one or two commands.
```

After publish the case went on the board. After the worker submitted a patch it showed **Under review**.

---

## 3. What would not be accepted

Putting the full program only inside `README.md` is not enough.

Criteria #1 asks for a **runnable file** such as `even-odd.js`. A README is documentation. `node even-odd.js 7` cannot run if that file is missing. The first PatchCourt test already showed that a README-only patch is rejected when the criteria ask for something concrete.

Correct shape:

- `even-odd.js` (or `.py`) in the PR
- README only explains how to run it

---

## 4. Worker GitHub work

The worker already had a fork and an open PR from the first test:

https://github.com/akashalamin10/patchcourt-test/pull/1

`https://github.com/akashalamin10/patchcourt-test/pull/2` does **not** exist. Opening it shows “Nothing found” / 404. GitHub assigns the number; you cannot invent `#2`.

For this bounty the same PR `#1` was reused. The worker added the program on branch `AKASH281221-patch-1` so the existing PR picked up the new file.

### 4.1 Program file to add

On the fork, branch `AKASH281221-patch-1`:

1. Open https://github.com/AKASH281221/patchcourt-test/tree/AKASH281221-patch-1
2. **Add file → Create new file**
3. Name: `even-odd.js`
4. Commit onto `AKASH281221-patch-1` (do not start a second PR unless you really want a new number)

File contents:

```js
#!/usr/bin/env node
"use strict";

function classifyInteger(raw) {
  const text = String(raw).trim();
  if (text === "") {
    throw new Error("Please enter an integer.");
  }
  if (!/^[+-]?\d+$/.test(text)) {
    throw new Error("Input must be an integer (no decimals or letters).");
  }
  const n = Number.parseInt(text, 10);
  return {
    value: n,
    parity: n % 2 === 0 ? "even" : "odd",
  };
}

function main() {
  const arg = process.argv[2];
  const run = (raw) => {
    const result = classifyInteger(raw);
    console.log(`${result.value} is ${result.parity}.`);
  };

  if (arg !== undefined) {
    run(arg);
    return;
  }

  process.stdout.write("Enter an integer: ");
  process.stdin.setEncoding("utf8");
  process.stdin.once("data", (chunk) => {
    try {
      run(chunk);
      process.exit(0);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  });
}

try {
  if (require.main === module) {
    main();
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

module.exports = { classifyInteger };
```

### 4.2 README addition only (not the full program)

```md
## Even or odd

Check whether a user-entered integer is even or odd.

### How to run
node even-odd.js 7
node even-odd.js 4
```

Confirm on the PR **Files changed** tab that `even-odd.js` is listed:

https://github.com/akashalamin10/patchcourt-test/pull/1

Leave the PR open. Do not merge.

If a new PR is opened correctly into `akashalamin10/patchcourt-test`, use that new URL instead. The fork URL alone is not valid for Submit patch:

- Wrong: `https://github.com/AKASH281221/patchcourt-test`
- Wrong: `https://github.com/akashalamin10/patchcourt-test/pull/2` (does not exist)
- Right: `https://github.com/akashalamin10/patchcourt-test/pull/1` (or a later real PR number)

---

## 5. What the worker entered on the site

Worker account → bounty board → **Claim** the $30 even/odd case → **Submit patch**.

| Field | Value |
| --- | --- |
| Branch or commit link | `https://github.com/akashalamin10/patchcourt-test/pull/1` |
| Explanation | See below |

### Explanation (paste)

```
Added even-odd.js that reads an integer from a CLI argument or stdin and prints whether it is even or odd. Non-integer input is rejected with an error. README documents the run commands: node even-odd.js 7 and node even-odd.js 4.
```

After submit, buyer detail showed submission `#T3QF` while the bounty stayed **Under review** until judged.

---

## 6. Buyer judgment

Buyer opened bounty detail and clicked **⚡ Judge with wallet (GenLayer)**, then approved the wallet transaction.

### Result on the page

```
Submission #T3QF  Approved
https://github.com/akashalamin10/patchcourt-test/pull/1

Judged on-chain (PARTIAL) · View on GenLayer Explorer →
```

Two different labels:

| Place | Text |
| --- | --- |
| Submission row | Approved |
| On-chain line | PARTIAL |

GenLayer did not fully reject the work and did not give a clean full approve. **PARTIAL** means the patch matched some of the five criteria, not all of them (or the judge was not fully confident). The site still painted the row as Approved.

Likely reasons for PARTIAL rather than a clean APPROVED:

- PR `#1` still carries the old README-bounty commits, so the diff is mixed
- The even-odd file may have landed late on a long-lived branch
- Criteria asked for a dedicated program file, examples, error handling, and README run steps in one PR that already had unrelated history

The explorer link on the page uses the app’s configured explorer host. The transaction hash on that page is the on-chain proof.

Do not click **Approve & settle** or **Reject** after the chain verdict unless you are testing the manual buttons on purpose.

---

## 7. IDs from this run

| Item | Value |
| --- | --- |
| Bounty description | Check whether a user-entered integer is even or odd |
| Reward | $30 |
| Deadline | 5 hours |
| Submission | `#T3QF` |
| PR | https://github.com/akashalamin10/patchcourt-test/pull/1 |
| Site status | Approved |
| Chain verdict | PARTIAL |

---

## 8. Repeat checklist

- [ ] Buyer pastes the description, `$30`, `5 hours`, and the five-point criteria
- [ ] Worker adds `even-odd.js` on the patch branch (not README-only)
- [ ] README only gets the two `node even-odd.js` commands
- [ ] PR targets `akashalamin10/patchcourt-test`, not only the fork
- [ ] Worker claims, pastes the real `/pull/N` URL and the explanation
- [ ] Buyer refreshes bounty detail until the submission row appears
- [ ] Buyer clicks **Judge with wallet**
- [ ] Record both labels: site status and `Judged on-chain (...)`

To aim for a cleaner **APPROVED** next time, open a **new branch and a new PR** that contains only `even-odd.js` plus a short run section. Do not keep stacking unrelated README tests onto PR `#1`.

---

## 9. Short story

The buyer paid $30 for a program that reads an integer and prints even or odd, with a real file, worked examples, bad-input handling, and a short README. The worker reused pull request `#1` instead of a missing `#2`, added `even-odd.js`, and submitted that link. GenLayer returned **PARTIAL** on-chain. The PatchCourt UI showed the submission as **Approved**. That is the outcome of this test: the even/odd bounty ran end to end, and the verdict was mixed rather than a full pass or a full fail.
