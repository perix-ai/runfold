# Checkpoint

Durable logical recovery boundaries for resume, restore and fork.

A Checkpoint is an immutable manifest. It MUST contain:

- `checkpoint_id`, `namespace_id` and `stream_id`;
- the exact boundary `seq`;
- `state_ref` and `state_digest` for a logical State snapshot;
- `materializer_id`, `materializer_version` and snapshot schema version;
- creation metadata.

It MAY contain an opaque `execution_ref` owned by the Execution Plane. Runtime
Data stores this reference but MUST NOT infer that the external snapshot still
exists.

Publishing the manifest and appending its canonical checkpoint-created event
MUST be one Runtime Data transaction.

Restore MUST verify the snapshot digest and identity, restore it at the recorded
Revision, then apply later events. A Checkpoint MUST NOT be moved to another
Revision or overwritten in place.
