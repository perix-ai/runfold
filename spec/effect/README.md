# Effect

External-world side effects and their transaction semantics.

## Record

Every Effect MUST have `effect_id`, `namespace_id`, `stream_id`, declaration
Revision, effect type, target, request digest, stable `idempotency_key`, status
and attempt metadata. The tuple `(namespace_id, effect type, idempotency_key)`
MUST be unique; reuse with a different target or request digest is an integrity
error.

## Lifecycle

```text
declared -> claimed -> committed
               |---> failed -----> claimed (policy retry)
               `---> unknown ----> committed | failed (reconciliation)
```

- `declared` records intent before external execution.
- `claimed` grants one worker a time-bounded lease.
- `committed` records confirmed external reality and is terminal.
- `failed` means the attempt is known not to have committed externally and may
  be retried according to policy.
- `unknown` means an external commit may have occurred but was not durably
  recorded.

The declaration and every status transition MUST commit atomically with their
canonical events. Lease ownership MUST be checked when recording an outcome. An
expired claim MUST become `unknown` unless the executor can prove external
invocation never started.

An `unknown` Effect MUST be reconciled before retry unless the target operation
is known to honor the same idempotency key. Reconciliation transitions it to
`committed` or `failed`. A retry of a committed Effect MUST return the recorded
result and MUST NOT invoke the external system again.

Compensation is a new Effect linked to the original; it does not rewrite the
original outcome.
