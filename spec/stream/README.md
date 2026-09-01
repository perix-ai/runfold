# Stream

An ordered root or child line of logical history within a Session.

## Record

Every Stream MUST contain `namespace_id`, `execution_id`, `session_id`,
`stream_id`, `kind`, `creation_command_id`, `created_event_id`, creation metadata
and a schema version. `kind` is `root` or `child`.

A Session MUST have exactly one root Stream. A child Stream MUST additionally
contain immutable lineage:

- `parent_stream_id`;
- `parent_seq`;
- `checkpoint_id`.

Root Streams MUST NOT contain parent lineage. A Stream MUST never be reparented.

## Root creation

```text
create_root(session_id, stream_id, command_id) -> Stream
```

The operation MUST atomically create the Session's root Stream and append a
`runtime.stream.created` event as sequence 1. A Session MUST reject creation of a
second root. Exact command retries return the original Stream.

## Fork behavior

Fork is a command, not a persisted entity:

```text
fork(checkpoint_id, child_stream_id, command_id) -> Stream
```

The operation MUST verify that the Checkpoint belongs to a Stream in the same
namespace and Session. It then atomically creates the child Stream and appends a
`runtime.stream.forked` event as child sequence 1.

An exact retry with the same `command_id` or `child_stream_id` and identical
input MUST return the original Stream. Reuse with different input MUST fail.
There is no `fork_id`; the durable result is the child Stream and its creation
Event.

## Logical history

The logical history of a root is its own events. The logical history of a child
is its parent's logical history through `parent_seq`, followed by the child's own
events. Parent events MUST NOT be copied or renumbered.

Nested child Streams are permitted. Importers MUST reject lineage cycles,
missing parents and checkpoint/boundary mismatches.
