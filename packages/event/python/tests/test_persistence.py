from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from runfold.event import (
    EventValidationError,
    JsonlSessionPersistence,
    SessionFormatUnsupportedError,
    SessionPersistenceCorruptionError,
    SessionStore,
    encode_segment,
    project_dir,
)
from runfold.event import _zstd

from tests.test_session import append_closed_turn, user_message


class PersistenceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="runfold-event-python-")
        self.root = Path(self.temporary.name)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_plain_round_trip_list_suffix_raw_resume_and_fork(self) -> None:
        persistence = JsonlSessionPersistence(self.root, compression="none")
        writer = SessionStore(persistence)
        original = writer.create("round-trip", meta={"cwd": "/workspace"})
        append_closed_turn(original)
        writer.close()

        loaded = persistence.load("round-trip")
        self.assertEqual(len(loaded.events), 7)
        self.assertEqual([header["id"] for header in persistence.list()], ["round-trip"])
        self.assertEqual(
            [event["seq"] for event in persistence.read_from("round-trip", 5).events],
            [5, 6],
        )
        raw = persistence.read_raw("round-trip")
        self.assertIsNotNone(raw)
        self.assertTrue(raw.content.endswith("\n"))
        self.assertIn("question-1", raw.content)

        resumed_store = SessionStore(persistence)
        resumed = resumed_store.resume("round-trip")
        self.assertEqual(resumed.events[-1]["type"], "session/end-seed")
        child = resumed_store.fork(resumed, child_session_id="child")
        resumed_store.close()
        self.assertEqual(persistence.load("child").meta["parentSession"], "round-trip")
        self.assertEqual(persistence.load("child").events[-1]["type"], "session/end-seed")

    def test_plain_torn_tail_is_discarded_on_load(self) -> None:
        persistence = JsonlSessionPersistence(self.root, compression="none")
        store = SessionStore(persistence)
        session = store.create("torn")
        append_closed_turn(session)
        store.close()
        path = persistence.locate(session.header).path
        committed_size = path.stat().st_size
        with path.open("ab") as handle:
            handle.write(b'{"type":"partial"')
        self.assertGreater(path.stat().st_size, committed_size)

        loaded = persistence.load("torn")
        self.assertEqual(len(loaded.events), 7)
        self.assertEqual(path.stat().st_size, committed_size)

    def test_committed_corruption_before_turn_end_is_rejected(self) -> None:
        persistence = JsonlSessionPersistence(self.root, compression="none")
        store = SessionStore(persistence)
        session = store.create("corrupt")
        append_closed_turn(session)
        store.close()
        path = persistence.locate(session.header).path
        with path.open("ab") as handle:
            handle.write(b'{"bad":true}\n')
            handle.write(
                b'{"type":"turn/end","seq":7,"time":1,"data":{"turn":2,"reason":{"kind":"completed"}}}\n'
            )
        with self.assertRaises(SessionPersistenceCorruptionError):
            persistence.load("corrupt")

    def test_open_turn_is_durably_repaired_before_resume(self) -> None:
        persistence = JsonlSessionPersistence(self.root, compression="none")
        store = SessionStore(persistence)
        session = store.create("interrupted")
        session.append("turn/start", {"turn": 1})
        session.append("step/start", {"turn": 1, "step": 1})
        store.close()

        path = persistence.locate(session.header).path
        before_preview = path.read_bytes()
        preview = persistence.inspect("interrupted")
        self.assertEqual(
            [event["type"] for event in preview.events],
            ["turn/start", "step/start", "step/end", "turn/end"],
        )
        self.assertEqual(path.read_bytes(), before_preview)

        loaded = persistence.load("interrupted")
        self.assertEqual(
            [event["type"] for event in loaded.events],
            ["turn/start", "step/start", "step/end", "turn/end"],
        )
        self.assertEqual(loaded.events[-1]["data"]["reason"], {"kind": "interrupted"})
        self.assertEqual(len(persistence.inspect("interrupted").events), 4)
        self.assertNotEqual(path.read_bytes(), before_preview)

    def test_multiple_live_sessions_keep_persistence_isolated(self) -> None:
        persistence = JsonlSessionPersistence(self.root, compression="none")
        store = SessionStore(persistence)
        left = store.create("left")
        right = store.create("right")
        for session, text in ((left, "left-only"), (right, "right-only")):
            session.append("turn/start", {"turn": 1})
            session.append(
                "user/message",
                user_message(f"{session.id}-user", text),
                surface_op="append",
            )
            session.append(
                "turn/end", {"turn": 1, "reason": {"kind": "completed"}}
            )
        store.flush(left)
        store.flush(right)
        store.close()

        left_content = persistence.read_raw("left").content
        right_content = persistence.read_raw("right").content
        self.assertIn("left-only", left_content)
        self.assertNotIn("right-only", left_content)
        self.assertIn("right-only", right_content)
        self.assertNotIn("left-only", right_content)

    @unittest.skipUnless(_zstd.available(), "Zstandard backend is unavailable")
    def test_zstd_multiframe_round_trip_and_torn_frame_repair(self) -> None:
        persistence = JsonlSessionPersistence(self.root, compression="zstd")
        store = SessionStore(persistence)
        session = store.create("zstd")
        append_closed_turn(session)
        store.close()
        path = persistence.locate(session.header).path
        committed_size = path.stat().st_size

        extra = _zstd.compress_frame(b'{"type":"partial","seq":7')
        with path.open("ab") as handle:
            handle.write(extra[: max(1, len(extra) // 2)])

        loaded = persistence.load("zstd")
        self.assertEqual(len(loaded.events), 7)
        self.assertEqual(path.stat().st_size, committed_size)
        self.assertEqual(persistence.read_raw("zstd").meta["id"], "zstd")

    @unittest.skipUnless(_zstd.available(), "Zstandard backend is unavailable")
    def test_zstd_recovers_complete_events_from_checksum_torn_frame(self) -> None:
        persistence = JsonlSessionPersistence(self.root, compression="zstd")
        store = SessionStore(persistence)
        session = store.create("zstd-checksum")
        append_closed_turn(session)
        store.close()
        path = persistence.locate(session.header).path

        second_turn = (
            b'{"type":"turn/start","seq":7,"time":8,"data":{"turn":2}}\n'
            b'{"type":"turn/end","seq":8,"time":9,"data":{"turn":2,'
            b'"reason":{"kind":"completed"}}}\n'
        )
        frame = _zstd.compress_frame(second_turn)
        self.assertTrue(frame[4] & 0x04)
        with path.open("ab") as handle:
            handle.write(frame[:-1])

        loaded = persistence.load("zstd-checksum")
        self.assertEqual([event["seq"] for event in loaded.events], list(range(9)))
        self.assertEqual(loaded.events[-1]["type"], "turn/end")
        self.assertIsNone(_zstd.scan_frames(path.read_bytes()).torn_start)

    def test_rejects_obsolete_flat_file_layout(self) -> None:
        persistence = JsonlSessionPersistence(self.root, compression="none")
        project = project_dir(self.root, "/legacy")
        project.mkdir(parents=True)
        legacy = project / f'{encode_segment("legacy-flat")}.jsonl'
        legacy.write_text("legacy\n", encoding="utf-8")

        with self.assertRaisesRegex(EventValidationError, "unsupported flat-file layout"):
            persistence.load("legacy-flat")
        with self.assertRaisesRegex(EventValidationError, "unsupported flat-file layout"):
            persistence.list()

    @unittest.skipUnless(_zstd.available(), "Zstandard backend is unavailable")
    def test_rejects_root_owned_by_opposite_encoding(self) -> None:
        plain_root = self.root / "plain"
        plain = JsonlSessionPersistence(plain_root, compression="none")
        plain_store = SessionStore(plain)
        plain_session = plain_store.create("plain")
        plain_session.append("turn/start", {"turn": 1})
        plain_session.append("turn/end", {"turn": 1, "reason": {"kind": "completed"}})
        plain_store.close()
        with self.assertRaisesRegex(EventValidationError, "configured for compression 'zstd'"):
            JsonlSessionPersistence(plain_root, compression="zstd").list()

        zstd_root = self.root / "zstd-root"
        zstd = JsonlSessionPersistence(zstd_root, compression="zstd")
        zstd_store = SessionStore(zstd)
        zstd_session = zstd_store.create("zstd")
        zstd_session.append("turn/start", {"turn": 1})
        zstd_session.append("turn/end", {"turn": 1, "reason": {"kind": "completed"}})
        zstd_store.close()
        with self.assertRaisesRegex(EventValidationError, "configured for compression 'none'"):
            JsonlSessionPersistence(zstd_root, compression="none").list()

    def test_required_unknown_event_refuses_but_ignorable_survives(self) -> None:
        required = JsonlSessionPersistence(self.root / "required", compression="none")
        store = SessionStore(required)
        session = store.create("future")
        session.append("future/required", {})
        store.close()
        with self.assertRaises(SessionFormatUnsupportedError):
            required.load("future")

        optional = JsonlSessionPersistence(self.root / "optional", compression="none")
        optional_store = SessionStore(optional)
        optional_session = optional_store.create("future")
        optional_session.append("future/informational", {}, ignorable=True)
        optional_store.close()
        self.assertEqual(optional.load("future").events[0]["type"], "future/informational")

    def test_packed_chunks_are_present_in_raw_artifact(self) -> None:
        persistence = JsonlSessionPersistence(
            self.root, compression="none", pack_chunks=True
        )
        store = SessionStore(persistence)
        session = store.create("chunks")
        for text in ("a", "b", "c"):
            session.append(
                "assistant/chunk",
                {
                    "turn": 1,
                    "step": 1,
                    "chunk": {"type": "text-delta", "index": 0, "text": text},
                },
            )
        store.close()
        self.assertIn('"type":"text-chunks"', persistence.read_raw("chunks").content)
        self.assertEqual(len(persistence.load("chunks").events), 3)

    def test_twenty_thousand_event_history_round_trips_as_one_packed_run(self) -> None:
        persistence = JsonlSessionPersistence(
            self.root, compression="none", pack_chunks=True
        )
        store = SessionStore(persistence)
        session = store.create("large-history")
        for sequence in range(20_000):
            session.append(
                "assistant/chunk",
                {
                    "turn": 1,
                    "step": 1,
                    "chunk": {
                        "type": "text-delta",
                        "index": 0,
                        "text": str(sequence % 10),
                    },
                },
            )
        store.close()

        loaded = persistence.load("large-history")
        self.assertEqual(len(loaded.events), 20_000)
        self.assertEqual(loaded.events[-1]["seq"], 19_999)
        raw = persistence.read_raw("large-history")
        self.assertEqual(raw.content.count("\n"), 2)
        self.assertIn('"type":"text-chunks"', raw.content)


if __name__ == "__main__":
    unittest.main()
