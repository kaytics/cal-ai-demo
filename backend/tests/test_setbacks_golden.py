"""Golden cases for the pure engine (rules_core.check_setbacks)."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from rules_core import ComputedOutcome, InsufficientInput, check_setbacks

_GOLDEN = (
    Path(__file__).parents[2] / "fixtures" / "golden" / "rules-setbacks.yaml"
)
_CASES = yaml.safe_load(_GOLDEN.read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", _CASES, ids=[c["name"] for c in _CASES])
def test_setbacks_golden(case: dict) -> None:
    outcome = check_setbacks(case["inputs"])
    expect = case["expect"]

    if expect.get("abstain"):
        assert isinstance(outcome, InsufficientInput)
        assert outcome.missing == expect["missing"]
        return

    assert isinstance(outcome, ComputedOutcome)
    assert outcome.verdict == expect["verdict"]
    assert outcome.required == expect["required"]
    assert outcome.margin == expect["margin"]
    assert (outcome.preemption is not None) == expect["preemption"]
