"""Guards against the exact bug the previous version had: the payout split
living in two places and silently drifting apart. If this fails, make the
contract the source of truth and copy its values into escrow_logic.py.
"""
import os
import re

HERE = os.path.dirname(__file__)
CONTRACT = os.path.join(HERE, "..", "patch_court_contract.py")
MIRROR = os.path.join(HERE, "..", "escrow_logic.py")


def _dict_block(path, name):
    source = open(path).read()
    match = re.search(name + r" = \{(.*?)\n\}", source, re.S)
    assert match, f"{name} not found in {path}"
    return match.group(1).strip()


def _tuple_block(path, name):
    source = open(path).read()
    match = re.search(name + r" = \((.*?)\)", source, re.S)
    assert match, f"{name} not found in {path}"
    return " ".join(match.group(1).split())


def test_settlement_bps_does_not_drift():
    assert _dict_block(CONTRACT, "SETTLEMENT_BPS") == _dict_block(MIRROR, "SETTLEMENT_BPS")


def test_gaming_signals_do_not_drift():
    assert _tuple_block(CONTRACT, "GAMING_SIGNALS") == _tuple_block(MIRROR, "GAMING_SIGNALS")


def test_test_file_markers_do_not_drift():
    assert _tuple_block(CONTRACT, "TEST_FILE_MARKERS") == _tuple_block(MIRROR, "TEST_FILE_MARKERS")


def test_depends_line_is_pinned_not_latest():
    source = open(CONTRACT).read()
    match = re.search(r'"Depends":\s*"([^"]+)"', source)
    assert match, "contract must declare a Depends line"
    assert not match.group(1).endswith(":latest"), (
        "Depends must pin an exact runtime build; a floating :latest tag can "
        "resolve differently on different validators and break consensus."
    )
