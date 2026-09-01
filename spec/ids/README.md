# IDs

Stable identities for namespaces, executions, sessions, streams, events,
checkpoints, artifacts, effects and idempotent commands.

## Requirements

- IDs MUST be opaque, globally unique within a `namespace_id` and stable across
  harness and storage adapters.
- Persisted runtime records MUST carry `namespace_id`; references MUST NOT cross
  a namespace boundary.
- An ID MUST NOT encode mutable attributes, ordering or authorization decisions.
- Importers MUST preserve a source-system ID as metadata instead of substituting
  it for the canonical ID.
- Retries MUST reuse the same canonical ID for the same logical operation.

Recommended human-readable prefixes are `ns_`, `exec_`, `sess_`, `strm_`,
`evt_`, `ckpt_`, `art_`, `eff_` and `cmd_`. Prefixes aid diagnostics but have no
semantic meaning.

A Revision is not an ID. It is the pair `(stream_id, seq)`.
