def settlement_split(verdict: str) -> dict:
    if verdict == "APPROVED":
        return {"worker_share": 1.0, "buyer_refund": 0.0}
    if verdict == "PARTIAL":
        return {"worker_share": 0.7, "buyer_refund": 0.3}
    return {"worker_share": 0.0, "buyer_refund": 1.0}


def apply_settlement(reward: int, verdict: str) -> dict:
    split = settlement_split(verdict)
    return {
        "worker_amount": round(reward * split["worker_share"], 2),
        "buyer_refund": round(reward * split["buyer_refund"], 2)
    }
