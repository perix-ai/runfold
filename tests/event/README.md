# Event tests

This directory contains tests that exercise more than one language
implementation. Language-specific tests remain beside their implementation
under `packages/event/<language>/tests/`.

`cross-language/` verifies shared conformance fixtures, bidirectional
restore/resume/fork behavior, persistence interoperability, and rendering of
Python-generated Events through the TypeScript Trajectory UI.
