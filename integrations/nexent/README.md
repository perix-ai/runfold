# Nexent integrations

These directories preserve Runfold Event integration changes for exact Nexent
versions. They contain only downstream changes, not a copy or fork of Nexent.

| Nexent baseline | Status | Integration |
| --- | --- | --- |
| `v2.5.0` | Local interoperability experiment; not submitted upstream | [`v2.5.0/`](v2.5.0/) |

Create a new version directory when rebasing onto a newer Nexent release. Do
not silently overwrite a previously verified patch set: corrective revisions
must retain the former commit provenance in the manifest and independently
replay both the baseline and resulting Git trees.
