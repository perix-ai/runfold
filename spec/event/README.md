# Event

Canonical append-only execution facts.

## Envelope

Every persisted Event MUST contain:

```text
namespace_id
event_id
stream_id
seq
type
schema_version
recorded_at
payload
```

An Event MAY contain `occurred_at`, `causation_event_id`, `correlation_id` and a
namespaced `extensions` object. `recorded_at` is audit metadata and MUST NOT be
used for stream ordering. `schema_version` is a positive integer. `payload` and
`extensions` are JSON objects.

## Append contract

`append(stream_id, expected_seq, event_drafts[])` accepts drafts without `seq` or
`recorded_at`; the Runtime Data implementation assigns those fields. It MUST:

- atomically reject the complete batch when `expected_seq` is not the current
  stream head;
- assign contiguous sequence numbers beginning at `expected_seq + 1`;
- commit either every event in the batch or none of them;
- treat an exact retry whose Event IDs already occupy one contiguous committed
  batch with identical client-supplied content as successful, even though the
  original `expected_seq` is now stale;
- reject reuse of an `event_id` with different content.

Partial Event-ID reuse or reuse across streams MUST be rejected. Idempotency is
evaluated before reporting an expected-sequence conflict.

Streams are ordered independently. Cross-stream relationships MUST use explicit
IDs and Revisions.

## Evolution

`type` identifies semantics and `schema_version` identifies payload shape.
Readers MUST preserve unknown events. Recovery MUST fail clearly when an unknown
event affects materialization, unless a deterministic upcaster or an explicitly
documented ignorable-event rule exists.
