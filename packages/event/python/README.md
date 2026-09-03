# Python Event package

This directory is the native Python implementation of the Event trajectory
facility and the installable `runfold-event` distribution. The public SDK and
its implementation intentionally ship as one in-process package; there is no
TypeScript bridge or server client.

```text
python/
├── pyproject.toml
├── src/runfold/event/  # Public API and complete implementation
└── tests/              # Unit, integration, and package-consumer tests
```

Unlike the TypeScript extraction, Python has no retained DSH package workspaces
to wrap. `src/runfold/event/__init__.py` defines the supported public API, while
the sibling modules contain Session, surface, repair, message, chunk codec, and
JSONL persistence behavior.

## Install and use

```bash
pip install runfold-event
```

```python
from runfold.event import JsonlSessionPersistence, SessionStore, create_user_message

persistence = JsonlSessionPersistence("./sessions", compression="none")
store = SessionStore(persistence)
session = store.create("example", meta={"cwd": "/workspace"})
session.append("turn/start", {"turn": 1})
session.append(
    "user/message",
    create_user_message(
        content=[{"type": "text", "text": "hello"}],
        source={"kind": "user"},
    ),
    surface_op="append",
)
session.append("turn/end", {"turn": 1, "reason": {"kind": "completed"}})
store.close()
```

Python 3.14 uses standard-library Zstandard support. On Python 3.10–3.13,
install `runfold-event[zstd]`; plaintext JSONL needs no optional dependency.

The implementation preserves DSH format v0 field names and behavior while using
Runfold package names. Shared cross-language fixtures live under
`conformance/event/v0/`.

Run the Python suite from the repository root:

```bash
npm run test:python
npm run test:python:package
```

The current Python suite has 36 behavior tests. The package-consumer command
builds a wheel in an isolated builder, installs only that artifact with
`--no-index` into a second blank environment, and rejects imports from the
source tree. The root cross-language suite
also exercises plain and Zstandard files in both directions through Python's
public `restore/resume` methods and TypeScript's public `runtime.restore()`;
Python-generated Events are rendered by the TypeScript Trajectory UI.

The public API and exact TypeScript/Python behavior mapping are documented in
[`docs/event/specification.md`](../../../docs/event/specification.md).
