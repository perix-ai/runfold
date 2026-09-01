# Core Invariants

1. **Events are append-only.**
2. **Every event has stable identity and monotonic ordering within its stream.**
3. **State is derived/materialized, not a competing source of truth.**
4. **A checkpoint references an exact logical version.**
5. **A fork has explicit lineage to its parent and fork boundary.**
6. **Artifacts are immutable by version; updates create new versions.**
7. **Effects distinguish intent from externally committed reality.**
8. **Effect commits carry idempotency information where applicable.**
9. **Observability projections are not recovery truth.**
10. **Harness-, model-, execution-, and storage-specific details stay behind adapters.**
