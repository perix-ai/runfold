# Runfold open-source policy

## Scope

Runfold is published as open-source software under the MIT License. The root
[`LICENSE`](LICENSE) applies to original Runfold material and licensed
modifications unless a component carries a different or additional notice.
Third-party material remains subject to its own copyright and license terms.

The authoritative ownership boundary is [`COPYRIGHT.md`](COPYRIGHT.md), and
component provenance is recorded in [`NOTICE.md`](NOTICE.md) and the notices
shipped with each publishable package.

## Distribution requirements

Source and binary distributions must:

1. preserve the applicable copyright and permission notices required by the
   MIT License;
2. preserve third-party notices and licenses for material they include;
3. include the package-level `LICENSE` and `NOTICE.md` files in every published
   npm package or Python wheel;
4. keep the pinned DeepSeek Harness provenance and local-difference audit
   accurate; and
5. pass the repository's identity, build, behavior, conformance, and isolated
   package-consumer checks before release.

A downstream product may use Runfold package and API names without adopting the
Perix.ai project name in its own runtime namespace. Required copyright and
license notices must still accompany redistributed Runfold material.

## Third-party intake

Unmodified upstream snapshots belong under `third_party/` and must never be
edited to make a local build pass. Extracted source must retain a reproducible
mapping to its pinned revision. New dependencies must have an identified,
compatible license before they enter a distributed artifact; bundled code and
assets must carry all notices required by those licenses.

## Contributions

By submitting a contribution to this licensed repository, a contributor agrees
to license that contribution under the MIT License and represents that they have
the right to do so. A contribution does not transfer its copyright to Heiki
Scott, Perix.ai, or a future company unless the contributor signs a separate
written assignment. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

If centralized ownership is required later, a reviewed contributor agreement
must be introduced before accepting affected contributions; repository text
alone must not be treated as a retroactive assignment.

## Project names

Runfold is the project and product name. Perix.ai is the current project and
maintainer name. This policy concerns copyright and open-source distribution; it
does not represent either name as a registered trademark and does not grant a
right to imply endorsement by the maintainer.

## Ownership changes

Changing the copyright holder requires documented authority, such as a signed
assignment or an applicable operation of law. The corresponding change must
update the root and package notices together, pass the complete release gate,
and be recorded in the repository task log.
