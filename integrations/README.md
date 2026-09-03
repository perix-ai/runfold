# Integrations

This directory contains versioned downstream integrations that show how an
external product consumes Perix runtime-data facilities.

An integration is neither the reusable implementation under `packages/` nor an
unmodified upstream snapshot under `third_party/`. Each integration must name
an exact upstream baseline, preserve its application order, carry content
hashes, and be replay-tested against a clean baseline.

| Consumer | Facility | Delivery form |
| --- | --- | --- |
| [`nexent/`](nexent/) | Event recording, restore/resume/fork, and Trajectory UI | Versioned Git patch series |
