# Nexent v2.5.0 Event integration

This directory is the reproducible, reviewable delivery form of the Nexent
changes that were validated locally in branch
`codex/event-trajectory-v2.5.0`. It was exported directly from the eight
commits listed in [`manifest.json`](manifest.json); the patch bodies have not
been rewritten.

The integration adds:

- native Python Event recording around Nexent's real agent/model/tool flow;
- persistent Session identity, single-writer protection, cold restore/resume,
  repair, and stable-boundary fork;
- tenant-authorized trajectory read and fork endpoints;
- direct embedding of `@perix/event-ui` in the existing chat page while
  preserving the original conversation view and Composer;
- message-level and precise trajectory-level fork controls;
- tool schemas in Event request headers so the retained DSH detail panel can
  render Parameters, Result, Schema, and Timing;
- backend, frontend, short-trajectory, long-trajectory, failure-path, and
  cross-process tests.

This remains a Perix local interoperability experiment. It has not been
submitted to, endorsed by, or deployed by the Nexent project.

## Why patches

The files under [`patches/`](patches/) are a standard Git mail patch series.
They preserve the original commit boundaries and authorship and include binary
patches for the two pinned frontend packages. A single squashed diff would lose
that history; a Git bundle would unnecessarily redistribute the complete
Nexent repository.

This directory is therefore an integration artifact, not a second source of
truth for Event. Event implementation and packages remain under
[`packages/event/`](../../../packages/event/).

## Verify the artifact

Run from this directory:

```bash
shasum -a 256 -c SHA256SUMS
test "$(find patches -type f -name '*.patch' | wc -l | tr -d ' ')" = 8
```

[`series`](series) records the only supported application order.
[`manifest.json`](manifest.json) records the source commit and tree for every
patch, the exact upstream baseline, dependency revisions, statistics, and the
expected final tree.

## Apply to Nexent

Start from the exact upstream commit behind Nexent `v2.5.0`. A clean clone is
recommended:

```bash
git clone https://github.com/ModelEngine-Group/nexent.git
cd nexent
git switch --detach 86d75923dd549008d725d83db18a93d654c84fb0
test "$(git rev-parse HEAD^{tree})" = b442446293b6793498dac09be0b86f1dd0d340c5
git switch -c perix/event-trajectory-v2.5.0
integration_dir=/absolute/path/to/integrations/nexent/v2.5.0
while IFS= read -r patch; do
  git am --3way "$integration_dir/$patch" || exit
done < "$integration_dir/series"
test "$(git rev-parse HEAD^{tree})" = a3c97e4630464c5d5ae9492abb5c80fac3b6fd6f
```

The full path in `integration_dir` is intentional: run the commands inside
Nexent while the patches remain in this repository. If either tree assertion
fails, stop instead of forcing the patches; the checked-out source is not the
verified baseline or the replay is not identical.

The series includes two frontend package tarballs built from Perix commit
`3a1f931ddcd7f94944789a195536208405b7182d`. Their package-level hashes are
recorded in the manifest and in Nexent's resulting
`frontend/vendor/SHA256SUMS`. The Python package pin uses Perix commit
`2eea3f17e6a917ef3d640405b360664728d31e84`.

## Validate the applied integration

Install the Event and quality extras, then run each Python file in its own
process as required by Nexent's test isolation:

```bash
uv pip install -e './sdk[event,quality]'
python -m pytest test/sdk/core/agents/test_event_trajectory.py -q
python -m pytest test/sdk/core/agents/test_core_agent.py -q
python -m pytest test/sdk/core/agents/test_run_agent.py -q
python -m pytest test/sdk/core/agents/test_nexent_agent.py -q
python -m pytest test/sdk/core/agents/test_agent_model.py -q
python -m pytest test/backend/services/test_event_trajectory_service.py -q
python -m pytest test/backend/app/test_event_trajectory_app.py -q
```

Run the frontend checks from Nexent's `frontend/` directory:

```bash
shasum -a 256 -c vendor/SHA256SUMS
pnpm test
pnpm exec tsc --noEmit --incremental false
pnpm build
```

The original local acceptance produced 540/540 relevant Python tests and 27/27
frontend tests, followed by TypeScript checking and a production frontend
build. Detailed behavior and UI evidence remain in the Event task records:
[`R33`](../../../docs/event/tasks/R33-nexent-acceptance.md),
[`R37`](../../../docs/event/tasks/R37-nexent-trajectory-ui.md),
[`R38`](../../../docs/event/tasks/R38-nexent-long-trajectory.md), and
[`R40`](../../../docs/event/tasks/R40-nexent-narrated-interaction-demo.md).

## Upgrade policy

For another Nexent release, create `integrations/nexent/<version>/`, rebase or
port the commits there, run the relevant matrix again, and record new base and
result trees. Do not silently regenerate this `v2.5.0` series against a moving
branch.
