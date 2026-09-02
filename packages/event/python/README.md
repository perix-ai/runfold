# Python Event implementation

This directory is the native Python implementation of the Event trajectory
facility described in [`docs/event`](../../../docs/event/README.md).

```text
event/
├── sdk/
│   ├── pyproject.toml
│   └── src/perix_event/   # Complete implementation and public SDK
└── tests/                 # Unified Python unit/integration/package tests
```

Unlike the TypeScript extraction, Python has no retained DSH package workspaces
to wrap. The installable SDK therefore owns the complete Session, surface,
repair, message, chunk codec, and JSONL persistence logic under `src/perix_event`.
It does not invoke TypeScript and introduces no server process.

The implementation preserves DSH format v0 field names and behavior while using
Perix package names. Shared cross-language fixtures live under
`conformance/event/v0/`.

Run the Python suite from the repository root:

```bash
npm run test:python
npm run test:python:package
```

The public API and exact TypeScript/Python behavior mapping are documented in
[`docs/event/contract.md`](../../../docs/event/contract.md).
