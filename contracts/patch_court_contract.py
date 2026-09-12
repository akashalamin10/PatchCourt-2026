# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json


VERDICT_WORDS = ("APPROVED", "REJECTED", "PARTIAL")


class PatchCourt(gl.Contract):
    bounties: TreeMap[str, str]

    def __init__(self):
        self.bounties = TreeMap()

    def _sender(self) -> str:
        return str(gl.message.sender_address)

    @gl.public.write
    def post_bounty(
        self,
        bounty_id: str,
        repo_url: str,
        issue_description: str,
        reward: int,
        acceptance_criteria: str
    ) -> None:
        record = {
            "repo_url": repo_url,
            "issue_description": issue_description,
            "reward": reward,
            "acceptance_criteria": acceptance_criteria,
            "status": "open",
            "worker": "",
            "verdict": ""
        }
        self.bounties[bounty_id] = json.dumps(record)

    @gl.public.write
    def claim_bounty(self, bounty_id: str, worker_address: str) -> None:
        assert bounty_id in self.bounties, "bounty not found"
        record = json.loads(self.bounties[bounty_id])
        record["status"] = "claimed"
        record["worker"] = worker_address
        self.bounties[bounty_id] = json.dumps(record)

    def _verdict_prompt(
        self,
        issue_description: str,
        acceptance_criteria: str,
        diff_text: str,
        explanation: str,
        test_log: str
    ) -> str:
        return f"""
You are reviewing a submitted code patch for a bug bounty.

Issue: {issue_description}
Acceptance criteria: {acceptance_criteria}
Diff submitted by the worker:
{diff_text}

Worker's explanation: {explanation}
Automated test log: {test_log}

Decide whether this patch genuinely resolves the issue above, or whether it
only games the test -- for example by weakening an assertion instead of
fixing the underlying logic, or by claiming a fix the diff does not contain.

Respond with exactly one word: APPROVED, REJECTED, or PARTIAL.
""".strip()

    @gl.public.write
    def submit_verdict(
        self,
        bounty_id: str,
        issue_description: str,
        acceptance_criteria: str,
        diff_text: str,
        explanation: str,
        test_log: str
    ) -> None:
        # Auto-registers the bounty on first judgment, so this works whether
        # or not post_bounty/claim_bounty were ever called for this id.
        if bounty_id in self.bounties:
            record = json.loads(self.bounties[bounty_id])
        else:
            record = {
                "repo_url": "",
                "issue_description": issue_description,
                "reward": 0,
                "acceptance_criteria": acceptance_criteria,
                "status": "claimed",
                "worker": "",
                "verdict": ""
            }

        prompt = self._verdict_prompt(
            issue_description, acceptance_criteria, diff_text, explanation, test_log
        )

        def get_verdict() -> str:
            raw = gl.nondet.exec_prompt(prompt)
            text = str(raw).strip().upper()
            for word in VERDICT_WORDS:
                if word in text:
                    return word
            return "REJECTED"

        verdict = gl.eq_principle.prompt_comparative(
            get_verdict,
            principle="the one-word verdict (APPROVED, REJECTED, or PARTIAL) must be exactly the same.",
        )

        record["verdict"] = verdict
        record["status"] = "settled" if verdict in ("APPROVED", "PARTIAL") else "rejected"
        self.bounties[bounty_id] = json.dumps(record)

    @gl.public.view
    def get_bounty(self, bounty_id: str) -> dict:
        if bounty_id not in self.bounties:
            return {}
        return json.loads(self.bounties[bounty_id])

    @gl.public.view
    def list_bounty_ids(self) -> list[str]:
        return list(self.bounties.keys())
