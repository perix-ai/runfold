# Core Invariants

1. **Every record belongs to one namespace; cross-namespace references are invalid.**
2. **Committed events are immutable and append-only.**
3. **A stream has contiguous, monotonic sequence numbers allocated atomically.**
4. **Event identity is stable; the same ID cannot name different content.**
5. **State is a deterministic materialization at an exact stream revision.**
6. **A checkpoint immutably binds a revision to a verifiable logical snapshot.**
7. **A child stream starts from a checkpoint and has explicit parent lineage.**
8. **Artifact version records are immutable and identify their producing revision.**
9. **Artifact and Effect lifecycle records are transactionally tied to canonical events.**
10. **Effects distinguish intent, claims, committed reality, failure and uncertainty.**
11. **A committed Effect is terminal and protected by a stable idempotency key.**
12. **Unknown events are preserved and never silently skipped during recovery.**
13. **Observability projections are disposable and never recovery truth.**
14. **Harness-, model-, execution- and storage-specific behavior stays behind adapters.**
