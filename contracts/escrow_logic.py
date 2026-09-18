# Pure-Python mirror of the settlement math and anti-gaming screen inside
# patch_court_contract.py, kept here ONLY so it can be unit tested in plain
# pytest without spinning up the GenLayer runtime. The contract is the
# source of truth at deploy time; if you change SETTLEMENT_BPS or the
# gaming-signal lists in the contract, update them here too -- test_patch_court.py
# will fail loudly if the two drift apart.

SETTLEMENT_BPS = {
    "APPROVED": {"worker": 10000, "buyer": 0},
    "PARTIAL": {"worker": 7000, "buyer": 3000},
    "REJECTED": {"worker": 0, "buyer": 10000},
}

GAMING_SIGNALS = (
    "assertequal", "assert_equal", "asserttrue", "assert true",
    "expect(", "t.skip", "xit(", "xdescribe", "pytest.mark.skip",
    "@skip", "todo: fix", "hardcoded", "hard-coded",
)
TEST_FILE_MARKERS = ("test_", ".test.", "spec.", "_test.py", ".spec.")


def settlement_split(verdict: str) -> dict:
    bps = SETTLEMENT_BPS[verdict]
    return {"worker_share": bps["worker"] / 10000, "buyer_refund": bps["buyer"] / 10000}


def credit_amounts(reward: int, verdict: str) -> dict:
    bps = SETTLEMENT_BPS[verdict]
    worker_amount = reward * bps["worker"] // 10000
    buyer_amount = reward * bps["buyer"] // 10000
    return {"worker_amount": worker_amount, "buyer_amount": buyer_amount}


def looks_like_test_gaming(diff_text: str) -> bool:
    text = (diff_text or "").lower()
    touches_test = any(marker in text for marker in TEST_FILE_MARKERS)
    weakens = any(signal in text for signal in GAMING_SIGNALS)
    return touches_test and weakens
