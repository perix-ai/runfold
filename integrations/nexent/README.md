# Nexent integrations

These directories preserve Runfold Event integration changes for exact Nexent
versions. They contain downstream artifacts, not another copy of Nexent.

| Nexent baseline | Status | Integration |
| --- | --- | --- |
| `v2.5.0` | One-command local acceptance; not submitted upstream | [`v2.5.0/`](v2.5.0/) |
| `v2.5.1` | Same patch ported to the v2.5.1 tag; one-command local acceptance; not submitted upstream | [`v2.5.1/`](v2.5.1/) |

Patch files are checked out byte-for-byte (`-text` in `.gitattributes`). If a
patch ever shows `trailing whitespace` warnings or fails inside its binary
sections, the local copy was converted to CRLF line endings; re-check it out
after updating, or run the acceptance script, which verifies the patch
SHA-256 first and applies it with `git am --3way`.

Each current version keeps one supported patch and exact baseline/result trees.
Earlier revisions stay in Git history instead of the manual acceptance path.
Create a new directory when moving to another Nexent release; the acceptance
script selects a directory with `--nexent <version>` and
`npm run verify:integration-artifacts` checks every listed version.
