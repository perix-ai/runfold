# perix-event-sdk

Native Python implementation of the Perix Event trajectory facility extracted
from DeepSeek Harness behavior. This package contains the implementation itself;
it is not a client for a TypeScript process or server.

```python
from perix_event import JsonlSessionPersistence, SessionStore, create_user_message

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
store.flush(session)
store.close()

restored = SessionStore(persistence).resume("example")
```

Python 3.14 provides Zstandard support in the standard library. On Python
3.10–3.13, install `perix-event-sdk[zstd]`; plaintext JSONL needs no dependency.
Both backends write DSH-compatible independent frames with content checksums.

The public data contract uses the same camelCase JSON fields as the TypeScript
implementation so artifacts remain cross-language rather than being rewritten
at the SDK boundary.

See the repository's [Event v0 contract](../../../../docs/event/contract.md) for
the restore/resume/fork semantics and physical JSONL format.
