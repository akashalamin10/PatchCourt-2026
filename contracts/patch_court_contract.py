# v0.3.1
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

import genlayer as gl
from genlayer.types import *
import json


VERDICT_WORDS = ("APPROVED", "REJECTED", "PARTIAL")
GAMING_SIGNALS = (
    "assertequal", "assert_equal", "asserttrue", "assert true",
    "expect(", "t.skip", "xit(", "xdescribe", "pytest.mark.skip",
    "@skip", "todo: fix", "hardcoded", "hard-coded",
)
TEST_FILE_MARKERS = ("test_", ".test.", "spec.", "_test.py", ".spec.")


class PatchCourt(gl.contract.Contract):
    bounties_json: str
    credits_json: str
    owner: str

    def __init__(self):
        self.bounties_json = "{}"
        self.credits_json = "{}"
        self.owner = str(gl.message.sender_address).strip().lower()

    def _norm_addr(self, address: str) -> str:
        return str(address or "").strip().lower()

    def _sender(self) -> str:
        return self._norm_addr(str(gl.message.sender_address))

    def _all(self) -> dict:
        raw = self.bounties_json
        if raw is None or raw == "":
            return {}
        return json.loads(raw)

    def _put(self, bounty_id: str, record: dict) -> None:
        data = self._all()
        data[bounty_id] = record
        self.bounties_json = json.dumps(data)

    def _all_credits(self) -> dict:
        raw = self.credits_json
        if raw is None or raw == "":
            return {}
        return json.loads(raw)

    def _credit(self, address: str, amount: int) -> None:
        key = self._norm_addr(address)
        if amount <= 0 or key == "":
            return
        credits = self._all_credits()
        current = int(credits.get(key, 0))
        if current == 0:
            for stored, value in credits.items():
                if self._norm_addr(stored) == key:
                    current += int(value)
        credits[key] = current + int(amount)
        self.credits_json = json.dumps(credits)

    def _flag_test_gaming(self, diff_text: str) -> bool:
        text = (diff_text or "").lower()
        touches_test = False
        for marker in TEST_FILE_MARKERS:
            if marker in text:
                touches_test = True
                break
        weakens = False
        for signal in GAMING_SIGNALS:
            if signal in text:
                weakens = True
                break
        return touches_test and weakens

    def _empty_record(self) -> dict:
        return {
            "buyer": "",
            "worker": "",
            "repo_url": "",
            "issue_description": "",
            "acceptance_criteria": "",
            "reward": 0,
            "status": "open",
            "diff_text": "",
            "explanation": "",
            "test_log": "",
            "verdict": "",
            "verdict_reason": "",
            "gaming_flag": False,
            "worker_share_bps": 0,
            "buyer_refund_bps": 10000,
            "credited": False,
        }

    @gl.public.write
    def post_bounty(self, bounty_id: str, repo_url: str, issue_description: str, reward: int, acceptance_criteria: str) -> None:
        data = self._all()
        assert len(bounty_id) > 0, "bounty_id required"
        assert bounty_id not in data, "bounty already exists"
        assert reward >= 0, "reward must be >= 0"
        record = self._empty_record()
        record["buyer"] = self._sender()
        record["repo_url"] = repo_url
        record["issue_description"] = issue_description
        record["acceptance_criteria"] = acceptance_criteria
        record["reward"] = reward
        record["status"] = "open"
        self._put(bounty_id, record)

    @gl.public.write
    def claim_bounty(self, bounty_id: str) -> None:
        data = self._all()
        assert bounty_id in data, "bounty not found"
        record = data[bounty_id]
        sender = self._sender()
        assert record["status"] == "open", "bounty is not open"
        assert self._norm_addr(sender) != self._norm_addr(record["buyer"]), "buyer cannot claim their own bounty"
        record["worker"] = sender
        record["status"] = "claimed"
        self._put(bounty_id, record)

    @gl.public.write
    def submit_patch(self, bounty_id: str, diff_text: str, explanation: str, test_log: str) -> None:
        data = self._all()
        assert bounty_id in data, "bounty not found"
        record = data[bounty_id]
        sender = self._sender()
        assert self._norm_addr(sender) == self._norm_addr(record["worker"]), "only the assigned worker can submit a patch"
        record["diff_text"] = diff_text
        record["explanation"] = explanation
        record["test_log"] = test_log
        record["status"] = "under_review"
        record["verdict"] = ""
        record["verdict_reason"] = ""
        record["gaming_flag"] = self._flag_test_gaming(diff_text)
        self._put(bounty_id, record)

    def _verdict_prompt(self, record: dict) -> str:
        return (
            "You are a GenLayer validator judging a code-fix bounty. "
            "Issue: " + record.get("issue_description", "") + " "
            "Acceptance criteria: " + record.get("acceptance_criteria", "") + " "
            "Worker's explanation: " + record.get("explanation", "") + " "
            "Automated test log: " + record.get("test_log", "") + " "
            "Submitted diff: " + record.get("diff_text", "") + " "
            "APPROVED if the diff fixes production logic. "
            "REJECTED if it games tests or does not match the explanation. "
            "PARTIAL if the fix is incomplete. "
            "Respond with exactly one word: APPROVED, REJECTED, or PARTIAL."
        )

    @gl.public.write
    def submit_verdict(self, bounty_id: str) -> None:
        data = self._all()
        assert bounty_id in data, "bounty not found"
        record = data[bounty_id]
        assert record["status"] in ("under_review", "claimed"), "nothing to judge"
        assert len(record.get("diff_text", "")) > 0, "no patch submitted"
        prompt = self._verdict_prompt(record)

        def get_verdict() -> str:
            raw = gl.nondet.exec_prompt(prompt)
            text = str(raw).strip().upper()
            for word in VERDICT_WORDS:
                if word in text:
                    return word
            return "REJECTED"

        verdict = gl.eq_principle.prompt_comparative(
            get_verdict,
            "the one-word verdict (APPROVED, REJECTED, or PARTIAL) must be exactly the same.",
        )
        record["verdict"] = verdict
        record["verdict_reason"] = "validator_consensus"
        if verdict == "APPROVED":
            record["status"] = "settled"
            record["worker_share_bps"] = 10000
            record["buyer_refund_bps"] = 0
        elif verdict == "PARTIAL":
            record["status"] = "settled"
            record["worker_share_bps"] = 7000
            record["buyer_refund_bps"] = 3000
        else:
            record["status"] = "rejected"
            record["worker_share_bps"] = 0
            record["buyer_refund_bps"] = 10000

        if not record.get("credited", False):
            reward = int(record.get("reward", 0))
            worker_amount = reward * record["worker_share_bps"] // 10000
            buyer_amount = reward * record["buyer_refund_bps"] // 10000
            if record.get("worker", "") != "":
                self._credit(record["worker"], worker_amount)
            self._credit(record["buyer"], buyer_amount)
            record["credited"] = True

        self._put(bounty_id, record)

    @gl.public.view
    def get_bounty(self, bounty_id: str) -> str:
        data = self._all()
        if bounty_id not in data:
            return "{}"
        return json.dumps(data[bounty_id])

    @gl.public.view
    def list_bounty_ids(self) -> str:
        return json.dumps(list(self._all().keys()))

    # Additive, read-only, no state change: returns every bounty in one shot.
    # bounties_json already holds the whole collection as one string, so this
    # is literally free -- no extra storage, no extra computation, just
    # skipping the "one RPC call per bounty ID" pattern the frontend used to
    # be stuck with. Requires redeploying to pick up (existing deployments
    # keep working fine without it; the frontend falls back automatically).
    @gl.public.view
    def list_bounties(self) -> str:
        return self.bounties_json

    @gl.public.view
    def get_credit(self, address: str) -> int:
        credits = self._all_credits()
        key = self._norm_addr(address)
        if key in credits:
            return int(credits[key])
        total = 0
        matched = False
        for stored, value in credits.items():
            if stored == address or self._norm_addr(stored) == key:
                total += int(value)
                matched = True
        return total if matched else 0

    @gl.public.view
    def get_owner(self) -> str:
        return self.owner