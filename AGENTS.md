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
- Keep unmodified upstream source snapshots under `third_party/`. Never edit a
  pinned snapshot to make a local build pass.
- Preserve the retained DSH directory layout inside
  `packages/event/typescript/packages/`; the nested `packages/` directory is
  intentional provenance, not a general repository convention.

## Change lifecycle

1. Make the smallest coherent logical change. Do not accumulate unrelated work
   into one large commit.
2. Verify in proportion to risk. Documentation-only changes need link and diff
   checks; path or workspace changes need resolver, type, build, and targeted
   integration checks; behavioral or release changes require the complete
   relevant test matrix.
3. Commit each completed logical change with a descriptive conventional commit
   message.
4. Push that commit immediately to the current branch's configured upstream.
   Do not wait until the end of a long task to push a large batch.
5. Do not commit or push a known failing or incomplete logical change. If a
   required check is blocked by credentials, network, or external state, report
   the blocker instead.

Preserve unrelated user changes and never rewrite published history unless the
user explicitly requests it.
