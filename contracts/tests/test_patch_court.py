import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from escrow_logic import settlement_split, credit_amounts, looks_like_test_gaming


def test_settlement_split_approved():
    assert settlement_split("APPROVED") == {"worker_share": 1.0, "buyer_refund": 0.0}


def test_settlement_split_rejected():
    assert settlement_split("REJECTED") == {"worker_share": 0.0, "buyer_refund": 1.0}


def test_settlement_split_partial():
    assert settlement_split("PARTIAL") == {"worker_share": 0.7, "buyer_refund": 0.3}


def test_credit_amounts_integer_wei_split():
    assert credit_amounts(101, "PARTIAL") == {"worker_amount": 70, "buyer_amount": 30}
    assert credit_amounts(101, "APPROVED") == {"worker_amount": 101, "buyer_amount": 0}
    assert credit_amounts(101, "REJECTED") == {"worker_amount": 0, "buyer_amount": 101}


def test_detects_weakened_assertion():
    diff = """
--- a/tests/test_refund.py
+++ b/tests/test_refund.py
@@ -10,7 +10,7 @@
-    assertEqual(result, 42)
+    assertTrue(result > 0)
"""
    assert looks_like_test_gaming(diff) is True


def test_genuine_logic_fix_is_not_gaming():
    diff = """
--- a/src/refund.py
+++ b/src/refund.py
@@ -4,6 +4,6 @@
-    return total
+    return total - already_paid
"""
    assert looks_like_test_gaming(diff) is False


def test_skip_marker_on_test_file_is_gaming():
    diff = """
--- a/tests/test_login.py
+++ b/tests/test_login.py
@@ -1,3 +1,4 @@
+@pytest.mark.skip("flaky")
 def test_login_expires_token():
     ...
"""
    assert looks_like_test_gaming(diff) is True
