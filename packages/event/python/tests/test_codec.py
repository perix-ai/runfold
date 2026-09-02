from __future__ import annotations

import json
import unittest

from perix_event import (
    EventValidationError,
    Session,
    decode_seq_ranges,
    decode_storage_record,
    encode_segment,
    encode_seq_ranges,
    pack_chunk_runs,
    scan_log,
)

from tests import REPOSITORY_ROOT


class CodecTests(unittest.TestCase):
    def test_shared_packed_fixture_matches_expected_projection(self) -> None:
        fixture = (
            REPOSITORY_ROOT
            / "conformance"
            / "event"
            / "v0"
            / "fixtures"
            / "session.jsonl"
        )
        expected_path = fixture.with_name("session.expected.json")
        scan = scan_log(fixture.read_bytes())
        session = Session.from_restore(scan.meta["id"], scan.events, scan.meta)
        expected = json.loads(expected_path.read_text())

        self.assertEqual(scan.meta, expected["header"])
        self.assertEqual(len(scan.events), expected["eventCount"])
        self.assertEqual(list(session.surface.nodes), expected["surface"])
        self.assertEqual(session.derive_messages(), expected["messages"])

    def test_chunk_runs_pack_and_expand_losslessly(self) -> None:
        events = [
            {
                "type": "assistant/chunk",
                "seq": index,
                "time": 100 + index * 3,
                "data": {
                    "turn": 1,
                    "step": 1,
                    "chunk": {"type": "text-delta", "index": 0, "text": text},
                },
            }
            for index, text in enumerate(["a", "b", "c", "d"])
        ]
        packed = pack_chunk_runs(events)
        self.assertEqual(len(packed), 1)
        self.assertEqual(packed[0]["type"], "text-chunks")
        self.assertEqual(decode_storage_record(packed[0]), events)

    def test_malformed_chunk_row_fails_loud(self) -> None:
        with self.assertRaisesRegex(EventValidationError, "malformed text-chunks"):
            decode_storage_record(
                {
                    "type": "text-chunks",
                    "seq0": 0,
                    "time0": 0,
                    "data": {"turn": 1, "step": 1, "index": 0, "dt": [], "texts": []},
                }
            )

    def test_sequence_ranges_round_trip_and_validate(self) -> None:
        values = [1, 2, 3, 7, 9, 10, 11]
        encoded = encode_seq_ranges(values)
        self.assertEqual(encoded, [[1, 3], 7, [9, 11]])
        self.assertEqual(decode_seq_ranges(encoded), values)
        with self.assertRaisesRegex(EventValidationError, "strictly increasing"):
            decode_seq_ranges([[3, 5], 4])

    def test_path_encoding_uses_javascript_utf16_units(self) -> None:
        self.assertEqual(encode_segment("../x"), "..~002Fx")
        self.assertEqual(encode_segment("😀"), "~D83D~DE00")
        self.assertEqual(encode_segment("safe._-9"), "safe._-9")


if __name__ == "__main__":
    unittest.main()
