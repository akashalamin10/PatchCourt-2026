import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from escrow_logic import settlement_split, apply_settlement


def test_settlement_split_approved():
    assert settlement_split("APPROVED") == {"worker_share": 1.0, "buyer_refund": 0.0}


def test_settlement_split_rejected():
    assert settlement_split("REJECTED") == {"worker_share": 0.0, "buyer_refund": 1.0}


def test_settlement_split_partial():
    assert settlement_split("PARTIAL") == {"worker_share": 0.7, "buyer_refund": 0.3}


def test_apply_settlement_partial_amounts():
    result = apply_settlement(100, "PARTIAL")
    assert result["worker_amount"] == 70.0
    assert result["buyer_refund"] == 30.0
