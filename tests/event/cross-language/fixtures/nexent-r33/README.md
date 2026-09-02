# Nexent R33 acceptance fixture

This is a real Event v0 trajectory emitted by Nexent's Python execution path,
not a hand-authored Event sample.

- Nexent base: official develop commit 4e1fb31dd169917edcee549efc59957124d9d449.
- Nexent Event integration: commit 94c06828 on branch
  codex/event-trajectory.
- Perix Event package: 0.1.0 from commit
  2eea3f17e6a917ef3d640405b360664728d31e84.
- Interpreter: Python 3.11.15; perix_event resolved from site-packages with
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
