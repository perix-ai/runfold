from __future__ import annotations

import unittest

from runfold.event import EventValidationError, Session, fold_surface

from tests.test_session import assistant_message, user_message


def tool_result(identifier: str, content: str, *, code: str = "E") -> dict:
    return {
        "turn": 1,
        "step": 1,
        "message": {
            "id": identifier,
            "role": "user",
            "source": {"kind": "tool", "callId": "call-1"},
            "content": [
                {
                    "type": "tool-result",
                    "toolCallId": "call-1",
                    "content": [{"type": "text", "text": content}],
                }
            ],
        },
        "error": {"name": "ToolError", "code": code},
    }


class SurfaceTests(unittest.TestCase):
    def test_append_and_positional_replace(self) -> None:
        session = Session.create("surface")
        session.append(
            "user/message", user_message("u1", "one"), surface_op="append"
        )
        session.append(
            "assistant/message",
            {"turn": 1, "step": 1, "message": assistant_message("a1", "two")},
            surface_op="append",
            source_event_seqs=[],
        )
        session.append(
            "user/message",
            user_message("u2", "replacement"),
            surface_op={"op": "replace", "start": 0, "end": 1},
            source_event_seqs=[0, 1],
        )

        self.assertEqual(session.surface.nodes, (2,))
        self.assertEqual(session.surface.replace_generation, 1)
        self.assertEqual(session.derive_messages()[0]["id"], "u2")
        folded = fold_surface(session.events)
        self.assertEqual(folded.nodes, (2,))
        self.assertEqual(folded.replacements[0].shadowed_seqs, (0, 1))

    def test_provenance_must_be_unique_earlier_and_complete(self) -> None:
        session = Session.create("provenance")
        session.append(
            "user/message", user_message("u1", "one"), surface_op="append"
        )
        with self.assertRaisesRegex(EventValidationError, "duplicates"):
            session.append(
                "user/message",
                user_message("u2", "bad"),
                surface_op={"op": "replace", "start": 0, "end": 0},
                source_event_seqs=[0, 0],
            )
        session.append(
            "user/message", user_message("u-between", "two"), surface_op="append"
        )
        with self.assertRaisesRegex(EventValidationError, "missing 0"):
            session.append(
                "user/message",
                user_message("u3", "bad"),
                surface_op={"op": "replace", "start": 0, "end": 0},
                source_event_seqs=[1],
            )

    def test_tool_result_replacement_can_change_only_content(self) -> None:
        session = Session.create("tool-rewrite")
        session.append("tool/result", tool_result("r1", "before"), surface_op="append")
        replacement = tool_result("r1", "after")
        session.append(
            "tool/result",
            replacement,
            surface_op={"op": "replace", "start": 0, "end": 0},
            source_event_seqs=[0],
        )
        self.assertEqual(
            session.derive_messages()[0]["content"][0]["content"][0]["text"],
            "after",
        )

        invalid = tool_result("r1", "again", code="DIFFERENT")
        with self.assertRaisesRegex(EventValidationError, "change only content"):
            session.append(
                "tool/result",
                invalid,
                surface_op={"op": "replace", "start": 1, "end": 1},
                source_event_seqs=[1],
            )

    def test_empty_assistant_message_is_not_derived(self) -> None:
        session = Session.create("empty")
        message = assistant_message("a", "unused")
        message["content"] = []
        session.append(
            "assistant/message",
            {"turn": 1, "step": 1, "message": message},
            surface_op="append",
            source_event_seqs=[],
        )
        self.assertEqual(session.derive_messages(), [])


if __name__ == "__main__":
    unittest.main()
