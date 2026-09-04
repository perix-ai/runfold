# Changelog

All notable changes to Runfold are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-09-03

### Added

- TypeScript `@runfold/event` SDK for append-only Event Sessions, persistence,
  JSONL storage, restore/resume, repair, and stable-boundary fork.
- React `@runfold/trajectory-ui` for rendering Event trajectories, turns, tool
  calls, message projections, details, and schemas.
- Python `runfold-event` package with the same Event v0 behavior and shared
  cross-language fixtures.
- Versioned Nexent v2.5.0 interoperability patch series and a reproducible
  trajectory restore/fork Demo.

### Boundaries and known limitations

- Event v0 records trajectory facts; it is not a general agent memory, model
  router, sandbox, tool registry, or product control plane.
- `resume` restores and continues a persisted Event trajectory. It does not
  promise to recreate an arbitrary process call stack, external side effect,
  provider continuation token, or runtime object.
- Fork is restricted to stable boundaries and preserves the parent history;
  it does not undo external effects.
- The Nexent integration is a local interoperability experiment, not an
  official Nexent release or endorsement.

[0.1.0]: https://github.com/perix-ai/runfold/commit/869a9ea
