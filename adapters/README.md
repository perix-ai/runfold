# Adapters

Adapters isolate Perix Runtime Data from concrete harnesses, storage engines and observability backends.

## Categories

- `harness/` — translate harness-native events/state into canonical runtime-data contracts
- `storage/` — persist canonical data into concrete databases/object stores
- `observability/` — project canonical runtime data into OTel and related systems

Adapters must not redefine core runtime-data semantics.
