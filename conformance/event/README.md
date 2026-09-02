# Event conformance

Language-neutral fixtures and expected logical results for every Event
implementation. Version `v0` matches `SESSION_FORMAT_VERSION = 0` in the pinned
DSH extraction.

Each implementation must read the exact fixture bytes, expand storage-only
chunk rows and sequence ranges, validate the same Event log, and produce the
same normalized result. Writer interoperability is tested separately because
valid JSON key order and Zstandard frame bytes may differ.

`v0/cases/session-validation.json` is the shared valid/invalid Session corpus,
and `v0/cases/repair.json` fixes the exact deterministic crash-repair result.
Both implementations execute every case. `v0/fixtures/session.jsonl` is the
shared packed wire-format fixture and `session.expected.json` is its normalized
projection.
