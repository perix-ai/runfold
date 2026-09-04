# Repository maintenance rules

These rules apply to every automated change in this repository.

## Repository layout

- Put reusable, publishable code under `packages/<domain>/<language>/`.
- Put runnable development or product applications under
  `apps/<domain>/<language>/<app>/`.
- Keep language-specific tests with their implementation. Put cross-language
  tests under `tests/<domain>/`.
- Keep language-neutral wire contracts under `schemas/<domain>/` and shared
  behavioral fixtures under `conformance/<domain>/`.
- Put reusable repository verification scripts under `scripts/`; keep demo
  synthesis sources under `scripts/event/demos/` alongside their reproducible
  inputs and commands.
- Put versioned downstream integration artifacts under `integrations/<name>/<version>/`,
  including manifests, checksums, and ordered patch series; do not edit vendored
  upstream snapshots to make an integration pass.
- Put publishable demo outputs under `docs/<domain>/demos/` and acceptance
  screenshots or other review evidence under `docs/<domain>/evidence/`.
- Give every publishable demo its own directory and README with an explicit
  name, content summary, and date; register it in the directory-level demo
  catalog in the same commit so later demos cannot be mixed together.
- Keep unmodified upstream source snapshots under `third_party/`. Never edit a
  pinned snapshot to make a local build pass.
- Preserve the retained DSH directory layout inside
  `packages/event/typescript/packages/`; the nested `packages/` directory is
  intentional provenance, not a general repository convention.

## Documentation languages

- Treat the English `<name>.md` file as canonical and the Chinese
  `<name>.zh.md` file as its translation for every governing document at the
  top level of `docs/event/`.
- The paired governing set is `requirements`, `architecture`, `specification`,
  `testing`, and `decisions`. The English directory index `README.md` and the
  high-churn Chinese operational records `tasks.md` and `tasks/` are explicitly
  exempt from pairing.
- Add or change both files in a documentation pair in the same commit. Keep
  language-switch links in both copies, resolve conflicts in favor of the
  English canonical copy, and run `npm run verify:docs` before completion.

## Change lifecycle

1. Before implementing any code, test, configuration, or documentation change,
   record the intended logical change as an unchecked item in the applicable
   `docs/<domain>/tasks.md`. Create that domain task list if it does not exist.
   Maintaining the task list itself does not require a recursive meta-task.
2. For work handed to another person or tool, add a self-contained task brief
   under `docs/<domain>/tasks/` and link it from the checklist item.
3. Make the smallest coherent logical change. Do not accumulate unrelated work
   into one large commit.
4. Verify in proportion to risk. Documentation-only changes need link and diff
   checks; path or workspace changes need resolver, type, build, and targeted
   integration checks; behavioral or release changes require the complete
   relevant test matrix.
5. After verification, mark the task complete and record its date, result, and
   verification evidence. Do this in the implementation commit or in an
   immediate follow-up documentation commit before starting unrelated work.
6. Commit each completed logical change with a descriptive conventional commit
   message.
7. Push that commit immediately to the current branch's configured upstream.
   Do not wait until the end of a long task to push a large batch.
8. Do not mark a task complete or commit and push it while its required checks
   are known to fail or the logical change is incomplete. If a
   required check is blocked by credentials, network, or external state, report
   the blocker instead.

Preserve unrelated user changes and never rewrite published history unless the
user explicitly requests it.
