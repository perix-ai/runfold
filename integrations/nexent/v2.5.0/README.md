# Nexent v2.5.0 Event integration

This directory is the reproducible, reviewable delivery form of the Nexent
changes that were validated locally in branch
`codex/runfold-event-v2.5.0`. It was exported directly from the nine commits
listed in [`manifest.json`](manifest.json); the generated patch bodies have not
been edited after export.

The integration adds:

- native Python Event recording around Nexent's real agent/model/tool flow;
- persistent Session identity, single-writer protection, cold restore/resume,
  repair, and stable-boundary fork;
- tenant-authorized trajectory read and fork endpoints;
- direct embedding of `@runfold/trajectory-ui` in the existing chat page while
  preserving the original conversation view and Composer;
- message-level and precise trajectory-level fork controls;
- tool schemas in Event request headers so the retained DSH detail panel can
  render Parameters, Result, Schema, and Timing;
- backend, frontend, short-trajectory, long-trajectory, failure-path, and
  cross-process tests.

This remains a local Runfold interoperability experiment. It has not been
submitted to, endorsed by, or deployed by the Nexent project.

## Why patches

The files under [`patches/`](patches/) are a standard Git mail patch series.
The first eight commits preserve the validated implementation's authorship,
dates, logical boundaries, and behavior while replacing only its public project
identity; the ninth records installation before registry publication. The
series includes binary patches for the two pinned frontend packages. A single
squashed diff would lose that history; a Git bundle would unnecessarily
redistribute the complete Nexent repository.

This directory is therefore an integration artifact, not a second source of
truth for Event. Event implementation and packages remain under
[`packages/event/`](../../../packages/event/).

## Verify the artifact

Run from this directory:

```bash
shasum -a 256 -c SHA256SUMS
test "$(find patches -type f -name '*.patch' | wc -l | tr -d ' ')" = 9
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
git switch -c runfold/event-trajectory-v2.5.0
integration_dir=/absolute/path/to/integrations/nexent/v2.5.0
while IFS= read -r patch; do
  git am --3way "$integration_dir/$patch" || exit
done < "$integration_dir/series"
test "$(git rev-parse HEAD^{tree})" = 31c9fc070c80b8ee33ba165a42474e5cb1a19806
```

The full path in `integration_dir` is intentional: run the commands inside
Nexent while the patches remain in this repository. If either tree assertion
fails, stop instead of forcing the patches; the checked-out source is not the
verified baseline or the replay is not identical.

The series includes two frontend package tarballs built from the exact Runfold
source revision `d79ae963500b961d17a48503bc76df416f414660`. Rebuild both
packages whenever their published contents change, then regenerate patch 0003
and all descendant patches so the manifest's commit and tree chain remains
replayable. Their package-level hashes are
recorded in the manifest and in Nexent's resulting
`frontend/vendor/SHA256SUMS`. The Python dependency is `runfold-event==0.1.0`,
validated from Runfold commit `cb5916e02409e8c83e02ee4f99699c1be9c9fb40`;
before registry publication, build and install that wheel from this repository
before installing Nexent's `event` extra.

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
