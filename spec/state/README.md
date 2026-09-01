# State

Materialized logical runtime state derived from canonical events.

State is optimized for inspection and recovery speed, but is not an independent
source of truth.

A materialized State MUST record:

- `namespace_id` and `stream_id`;
- the exact applied Revision;
- `materializer_id` and `materializer_version`;
- a deterministic state payload or reference;
- a content digest when stored outside the primary database, including the
  canonical serialization and digest algorithm identifiers.

Given the same logical history and materializer version, materialization MUST
produce equivalent canonical state. Reapplying an already-applied event MUST NOT
advance or mutate State.

For a fork, logical history is the parent prefix through `parent_seq` followed by
the child stream's events. A State writer SHOULD use compare-and-swap on its
current Revision so concurrent materializers cannot move it backwards.
