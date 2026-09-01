# Storage Adapters

Adapters for concrete persistence backends such as PostgreSQL, Redis, object
storage and analytical stores.

Storage adapters implement persistence mechanics while preserving canonical
ordering, versioning and consistency semantics. A conformant adapter MUST provide
atomic expected-sequence appends, ID uniqueness, namespace isolation and the
transactional Artifact/Effect lifecycle writes required by the specifications.
