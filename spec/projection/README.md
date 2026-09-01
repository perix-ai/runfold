# Projection

Derived views of canonical runtime data.

Examples include OpenTelemetry mappings, analytics schemas and query-oriented
materializations. Projections are never the authoritative recovery source.

A projector MUST record or expose its source Revision so lag is measurable. It
MUST be safe to rebuild from canonical history and SHOULD be idempotent per
`event_id`.

Projection pipelines MAY sample, aggregate, redact or drop fields according to a
declared policy. Their failure MUST NOT roll back or block a committed canonical
write. Conformance tests validate mapping rules and provenance, not byte-for-byte
equivalence with the source event.
