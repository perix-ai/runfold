from __future__ import annotations

import unittest

from runfold.event import (
    Session,
    call_config_equals,
    canonical_header,
    fold_request_header,
    header_equals,
)


class RequestHeaderTests(unittest.TestCase):
    def test_canonicalization_and_latest_snapshot_fold(self) -> None:
        first = {
            "config": {"provider": "p", "model": "m"},
            "system": "",
            "tools": [],
        }
        second = {
            "config": {"provider": "p", "model": "m2", "stop": ["a", "b"]},
            "adapterDefaults": {"maxTokens": True},
            "system": "system",
        }
        events = [
            {"type": "request/header", "data": {"header": first}},
            {"type": "turn/start", "data": {"turn": 1}},
            {"type": "request/header", "data": {"header": second}},
        ]

        self.assertEqual(
            canonical_header(first),
            {"config": {"provider": "p", "model": "m"}},
        )
        self.assertEqual(fold_request_header(events), second)

    def test_config_and_tool_schema_equality_matches_dsh(self) -> None:
        config = {
            "provider": "p",
            "model": "m",
            "reasoningEffort": "high",
            "temperature": 0.2,
            "maxTokens": 100,
            "stop": ["a", "b"],
        }
        self.assertTrue(call_config_equals(config, dict(config)))
        self.assertFalse(call_config_equals(config, {**config, "stop": ["b", "a"]}))

        left = {"config": config, "tools": [{"name": "tool", "description": "d"}]}
        same = {"config": dict(config), "tools": [{"name": "tool", "description": "d"}]}
        reordered = {
            "config": dict(config),
            "tools": [{"description": "d", "name": "tool"}],
        }
        self.assertTrue(header_equals(left, same))
        self.assertFalse(header_equals(left, reordered))

    def test_session_folds_header_and_context_incrementally(self) -> None:
        session = Session.create("request-state")
        session.append(
            "request/header",
            {
                "reason": "initial",
                "header": {"config": {"provider": "p", "model": "m"}},
            },
        )
        session.append(
            "request/context",
            {"provider": "p", "model": "m", "contextWindow": 128_000},
        )
        self.assertEqual(session.request_header()["config"]["model"], "m")
        self.assertEqual(session.request_context()["contextWindow"], 128_000)

        session.append(
            "request/context",
            {"provider": "p", "model": "m2", "contextWindow": 64_000},
        )
        self.assertEqual(session.request_context()["model"], "m2")


if __name__ == "__main__":
    unittest.main()
