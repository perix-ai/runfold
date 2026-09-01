# Architecture

## Scope

Perix Runtime Data is the durable logical data layer beneath agent harnesses and above physical storage.

```text
Agent / Harness
      |
      v
Perix Runtime Data
  |-- Event
  |-- State
  |-- Checkpoint
  |-- Fork
  |-- Artifact metadata
  |-- Effect ledger
  `-- Projections
      |
      +--> Storage backends
      +--> OTel
      +--> Analytics
```

## Core relationship

Event, State, Checkpoint and Fork are one recovery model, not independent systems.

```text
Event Log
   |
   +--> materialize --> State
   |
   +--> snapshot ----> Checkpoint
   |
   `--> prefix ------> Fork
```

Artifacts and Effects reference the same execution/session/version identity model,
but have distinct persistence and transaction semantics.

## Separation from execution infrastructure

Execution-environment checkpoints (filesystem/process/runtime snapshots) belong to
the Execution Plane. Perix Runtime Data may reference them, but does not own them.

Example:

```text
logical_seq = 187
runtime_checkpoint_id = "runta:ckpt-42"
```

Recovery can then correlate logical and execution state without conflating them.
