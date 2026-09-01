# Artifact

Versioned metadata and lineage for generated files and data products.

Artifact bytes may live in external object storage; Runtime Data owns identity,
metadata, version references and lineage semantics.

An Artifact has a stable `artifact_id`. Each immutable version MUST record:

- `namespace_id`, `artifact_id` and `artifact_version`;
- the producing Revision;
- `uri`, media type, byte size and content digest when known;
- zero or more parent Artifact versions;
- creation metadata and a schema version.

Versions for one Artifact MUST be unique and MUST NOT be overwritten. Publishing
metadata and appending the corresponding canonical event MUST be one Runtime
Data transaction.

Deletion of external bytes does not delete lineage. Runtime Data SHOULD retain a
tombstone or availability status without mutating the historical version record.
