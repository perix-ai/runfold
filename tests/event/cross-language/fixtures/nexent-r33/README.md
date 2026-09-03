# Nexent R33 acceptance fixture

This is a real Event v0 trajectory emitted by Nexent's Python execution path,
not a hand-authored Event sample.

- Nexent source snapshot: `perix-ai/open-source/agent_platform/nexent`, the
  official `v2.5.0` Release ZIP recorded by the local source catalog (ZIP
  SHA-256 `a4be5bc01472dd12947b2dce21a4b74ee58735cbd4de8668d367695b866ce77f`).
- Snapshot identity: all 2,886 entries and 2,463 files (85,150,229 bytes) match
  Git tag commit `86d75923dd549008d725d83db18a93d654c84fb0` byte-for-byte.
- The snapshot has a local baseline branch `snapshot/v2.5.0` at commit
  `1b184cf019fe2a539fe1c340afd526544492a90c` and no configured remotes.
- Nexent Event integration: local-only commit
  `5c597209bb4a01866dc073ddacf7a2e682dd6d71` on branch
  `codex/event-trajectory-v2.5.0`. It is intentionally not pushed; this is an
  interoperability experiment, not a proposed Nexent upstream change.
- Runfold Event package: 0.1.0 from commit
  2eea3f17e6a917ef3d640405b360664728d31e84.
- Interpreter: Python 3.11.15; runfold.event resolved from site-packages with
  PYTHONPATH removed.

The parent was created in one process, resumed in a second process, and forked
after its second complete turn. A third process resumed and independently
continued the child:

~~~bash
env -u PYTHONPATH python test/sdk/core/agents/test_event_trajectory.py \
  --event-worker /absolute/artifact/root nexent-real tool -
env -u PYTHONPATH python test/sdk/core/agents/test_event_trajectory.py \
  --event-worker /absolute/artifact/root nexent-real answer nexent-real-fork
env -u PYTHONPATH python test/sdk/core/agents/test_event_trajectory.py \
  --event-worker /absolute/artifact/root nexent-real-fork child -
~~~

The checked-in copy changes only two environment-specific fields:

- The temporary absolute cwd and matching project directory became
  /workspace/nexent-acceptance and --workspace-nexent-acceptance--.
- Nexent's long generated system prompt became
  [Nexent system prompt omitted from sanitized acceptance fixture].

Event order, sequence numbers, timestamps, message and call IDs, tool inputs and
outputs, request reasons, seed markers, and fork lineage remain exactly as
emitted. The parent contains 21 Events. The child declares seedLength 21 and
contains 29 Events before a new consumer opens it.
