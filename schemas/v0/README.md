# V0 Schemas

Initial JSON Schema profile for the V0 Runtime Data contract.

Currently defined:

- `common.schema.json` — shared IDs, Revisions, timestamps and digests
- `stream.schema.json` — root and child Stream records
- `event.schema.json` — persisted canonical Event envelope

State, Checkpoint, Artifact and Effect schemas will be added as their payload and
encoding profiles are fixed. A schema here is not a substitute for the ordering,
atomicity or recovery rules in `spec/`.
