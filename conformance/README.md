# Conformance

Backend-neutral conformance and invariant tests for Runtime Data contracts.

Every storage adapter and reference implementation MUST run the same behavioral
suite. Tests compare canonical values and externally visible behavior, not
backend serialization or implementation details.

## Required areas

- namespace isolation and cross-namespace reference rejection
- root Stream creation and child Stream lineage
- atomic Event batch append and expected-sequence conflicts
- idempotent Event retry and conflicting Event-ID reuse
- contiguous ordering without timestamp dependence
- deterministic State replay and Revision compare-and-swap
- unknown-Event preservation and explicit recovery failure
- Checkpoint digest validation, immutability and restore consistency
- fork command idempotency, child sequence and boundary validation
- nested-child replay and malformed-cycle rejection
- Artifact version immutability, lineage and metadata/Event atomicity
- Effect leases, retry policy, idempotency and crash-window reconciliation
- Projection mapping, provenance, replay idempotency and lag reporting

Reusable behavioral definitions live in `cases/`; portable input and expected
output data live in `fixtures/`. Implementation-specific unit and integration
tests remain with each implementation rather than in this directory.
