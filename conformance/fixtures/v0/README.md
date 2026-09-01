# V0 Fixtures

Portable fixtures for the V0 conformance cases.

The first fixture set will include a root Stream, a Checkpoint at a known
Revision, a forked child Stream, an Artifact derived on each branch and Effects
ending in `committed`, `failed` and `unknown`.

Each fixture must declare its schema version and expected canonical State value.
Digests are compared only when implementations use the same snapshot encoding
profile.
