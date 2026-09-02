# Event tests

This directory contains tests that exercise more than one language
implementation. Language-specific tests remain beside their implementation
under `packages/event/<language>/tests/`.

`cross-language/` verifies shared conformance fixtures, bidirectional
restore/resume/fork behavior, persistence interoperability, and rendering of
Python-generated Events through the TypeScript Trajectory UI. Its
`fixtures/nexent-r33/` artifact and `nexent-trajectory.spec.tsx` test
additionally prove that a real Nexent Python run, process restart, and fork are
accepted by the TypeScript public restore API and the retained Trajectory UI.
