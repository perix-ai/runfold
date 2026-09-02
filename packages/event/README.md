# Event packages

Language-specific implementations of the shared Event trajectory contract:

- `typescript/` retains and minimally adapts the pinned DSH Event,
  persistence, SDK, and Trajectory UI source.
- `python/` provides the native Python Event implementation and installable
  SDK.

Shared behavior and wire compatibility are defined in
[`docs/event`](../../docs/event/README.md), [`schemas/event`](../../schemas/event/),
and [`conformance/event`](../../conformance/event/). Bidirectional tests live in
[`tests/event`](../../tests/event/).
