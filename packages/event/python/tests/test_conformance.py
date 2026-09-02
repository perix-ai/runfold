from __future__ import annotations

import json
import unittest
from pathlib import Path

from perix_event import EventValidationError, Session
from perix_event import interrupted_turn_closers


REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
CASES = (
    REPOSITORY_ROOT
    / "conformance"
    / "event"
    / "v0"
    / "cases"
    / "session-validation.json"
)
REPAIR = CASES.with_name("repair.json")


class ConformanceTests(unittest.TestCase):
    def test_shared_session_acceptance_corpus(self) -> None:
        cases = json.loads(CASES.read_text(encoding="utf-8"))
        for case in cases:
            with self.subTest(case=case["name"]):
                accepted = True
                try:
                    Session.from_restore(
                        case["header"]["id"],
                        case["events"],
                        case["header"],
                    )
                except EventValidationError:
                    accepted = False
                self.assertEqual(accepted, case["accepted"])

    def test_shared_interrupted_turn_repair_result(self) -> None:
        case = json.loads(REPAIR.read_text(encoding="utf-8"))
        self.assertEqual(interrupted_turn_closers(case["events"]), case["expected"])


if __name__ == "__main__":
    unittest.main()
