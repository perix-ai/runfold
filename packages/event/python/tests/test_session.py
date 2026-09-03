from __future__ import annotations

import math
import unittest

from runfold.event import (
    EventValidationError,
    Session,
    SessionForkError,
    SessionStore,
)


def user_message(identifier: str, text: str) -> dict:
    return {
        "id": identifier,
        "role": "user",
        "content": [{"type": "text", "text": text}],
        "source": {"kind": "user"},
    }


def assistant_message(identifier: str, text: str) -> dict:
    return {
        "id": identifier,
        "role": "assistant",
        "content": [{"type": "text", "text": text}],
        "source": {"kind": "model", "provider": "test", "model": "event"},
    }


def append_closed_turn(session: Session, turn: int = 1) -> None:
    session.append("turn/start", {"turn": turn})
    session.append(
        "user/message",
        user_message(f"user-{turn}", f"question-{turn}"),
        surface_op="append",
    )
    session.append("step/start", {"turn": turn, "step": 1})
    session.append(
        "request/header",
        {
            "reason": "initial",
            "header": {"config": {"provider": "test", "model": "event"}},
        },
    )
    session.append(
        "assistant/message",
        {
            "turn": turn,
            "step": 1,
            "message": assistant_message(f"assistant-{turn}", f"answer-{turn}"),
        },
        surface_op="append",
        source_event_seqs=[],
    )
    session.append("step/end", {"turn": turn, "step": 1})
    session.append("turn/end", {"turn": turn, "reason": {"kind": "completed"}})


class SessionTests(unittest.TestCase):
    def test_records_contiguous_detached_events_and_derives_messages(self) -> None:
        session = Session.create("lifecycle")
        append_closed_turn(session)

        self.assertEqual([event["seq"] for event in session.events], list(range(7)))
        self.assertEqual(
            [message["role"] for message in session.derive_messages()],
            ["user", "assistant"],
        )
        self.assertEqual(
            session.request_header(),
            {"config": {"provider": "test", "model": "event"}},
        )

        detached = session.events
        detached[0]["data"]["turn"] = 99
        self.assertEqual(session.events[0]["data"]["turn"], 1)

    def test_append_rejects_non_json_without_mutating_log(self) -> None:
        session = Session.create("json")
        before = session.events
        with self.assertRaisesRegex(EventValidationError, "non-JSON-serializable"):
            session.append("turn/start", {"turn": math.nan})
        self.assertEqual(session.events, before)

        circular: list[object] = []
        circular.append(circular)
        with self.assertRaises(EventValidationError):
            session.append("custom/event", {"value": circular})
        self.assertEqual(session.seq, 0)

    def test_seed_is_validated_and_marked_once(self) -> None:
        source = Session.create("source")
        append_closed_turn(source)
        exported = list(source.events)

        replay = Session.create("replay", exported)
        self.assertEqual(list(replay.events[: len(exported)]), exported)
        self.assertEqual(replay.first_live_seq, len(exported))
        self.assertEqual(replay.events[-1]["type"], "session/end-seed")

        reopened = Session.create("reopened", replay.events)
        self.assertEqual(len(reopened.events), len(replay.events))
        self.assertEqual(reopened.events[-1]["type"], "session/end-seed")

    def test_each_live_suffix_gets_one_seed_boundary_and_terminal_replay_is_idempotent(self) -> None:
        source = Session.create("source-segments")
        append_closed_turn(source, 1)

        first = Session.create("first-segment", source.events)
        first_boundary = len(source.events)
        append_closed_turn(first, 2)

        second = Session.create("second-segment", first.events)
        second_boundary = len(first.events)
        self.assertEqual(
            [event["seq"] for event in second.events if event["type"] == "session/end-seed"],
            [first_boundary, second_boundary],
        )
        self.assertEqual(list(second.events[:second_boundary]), list(first.events))
        self.assertEqual(
            [event["seq"] for event in second.events],
            list(range(len(second.events))),
        )

        reopened = Session.create("terminal-marker", second.events)
        self.assertEqual(reopened.events, second.events)

    def test_seed_rejects_gaps_and_invalid_surface(self) -> None:
        with self.assertRaisesRegex(EventValidationError, "contiguous"):
            Session.create(
                "gap",
                [{"type": "turn/start", "seq": 1, "time": 1, "data": {"turn": 1}}],
            )
        with self.assertRaisesRegex(EventValidationError, "requires a surfaceOp"):
            Session.create(
                "surface",
                [
                    {
                        "type": "user/message",
                        "seq": 0,
                        "time": 1,
                        "data": user_message("u", "missing marker"),
                    }
                ],
            )

    def test_fork_accepts_only_stable_boundaries_and_records_lineage(self) -> None:
        store = SessionStore()
        parent = store.create("parent", meta={"cwd": "/workspace"})
        append_closed_turn(parent)

        child = store.fork(parent, child_session_id="child")
        self.assertEqual(list(child.events[:-1]), list(parent.events))
        self.assertEqual(child.header["parentSession"], "parent")
        self.assertEqual(child.header["seedLength"], len(parent.events))
        self.assertEqual(child.header["cwd"], "/workspace")
        self.assertEqual(child.events[-1]["type"], "session/end-seed")

        opened = store.create("open")
        opened.append("turn/start", {"turn": 1})
        with self.assertRaises(SessionForkError) as captured:
            store.fork(opened, 0, "bad-child")
        self.assertEqual(captured.exception.code, "OPEN_TURN")

    def test_header_and_message_runtime_validation(self) -> None:
        with self.assertRaisesRegex(EventValidationError, "absolute"):
            SessionStore().create("relative", meta={"cwd": "workspace"})
        with self.assertRaisesRegex(EventValidationError, "unsupported session metadata"):
            SessionStore().create("unknown-meta", meta={"server": True})

        session = Session.create("messages")
        with self.assertRaisesRegex(EventValidationError, "identified message"):
            session.append(
                "user/message",
                {"role": "user", "content": [], "source": {"kind": "user"}},
                surface_op="append",
            )


if __name__ == "__main__":
    unittest.main()
