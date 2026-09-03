from __future__ import annotations

import unittest

from runfold.event import (
    TOOL_NOT_STARTED,
    TOOL_OUTCOME_UNKNOWN,
    interrupted_turn_closers,
)

from tests.test_session import assistant_message


class RepairTests(unittest.TestCase):
    def test_balanced_or_empty_log_needs_no_repair(self) -> None:
        self.assertEqual(interrupted_turn_closers([]), [])
        self.assertEqual(
            interrupted_turn_closers(
                [
                    {"type": "turn/start", "seq": 0, "time": 10, "data": {"turn": 1}},
                    {
                        "type": "turn/end",
                        "seq": 1,
                        "time": 11,
                        "data": {"turn": 1, "reason": {"kind": "completed"}},
                    },
                ]
            ),
            [],
        )

    def test_closes_started_and_not_started_tool_calls_in_order(self) -> None:
        message = assistant_message("assistant", "")
        message["content"] = [
            {"type": "tool-call", "id": "started", "name": "read", "arguments": "{}"},
            {"type": "tool-call", "id": "not-started", "name": "write", "arguments": "{}"},
        ]
        events = [
            {"type": "turn/start", "seq": 0, "time": 100, "data": {"turn": 2}},
            {"type": "step/start", "seq": 1, "time": 101, "data": {"turn": 2, "step": 3}},
            {
                "type": "assistant/message",
                "seq": 2,
                "time": 102,
                "data": {"turn": 2, "step": 3, "message": message},
                "surfaceOp": "append",
                "sourceEventSeqs": [],
            },
            {
                "type": "tool/call",
                "seq": 3,
                "time": 103,
                "data": {
                    "turn": 2,
                    "step": 3,
                    "callId": "started",
                    "name": "read",
                    "arguments": "{}",
                },
            },
        ]
        closers = interrupted_turn_closers(events)

        self.assertEqual([event["seq"] for event in closers], [4, 5, 6, 7])
        self.assertTrue(all(event["time"] == 103 for event in closers))
        self.assertEqual(closers[0]["data"]["error"]["code"], TOOL_OUTCOME_UNKNOWN)
        self.assertEqual(closers[0]["sourceEventSeqs"], [3])
        self.assertEqual(closers[1]["data"]["error"]["code"], TOOL_NOT_STARTED)
        self.assertNotIn("sourceEventSeqs", closers[1])
        self.assertEqual(closers[2]["type"], "step/end")
        self.assertEqual(
            closers[3]["data"]["reason"], {"kind": "interrupted"}
        )


if __name__ == "__main__":
    unittest.main()
