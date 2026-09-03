from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import venv
from pathlib import Path
from shutil import copytree, ignore_patterns
from zipfile import ZipFile


PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="runfold-event-package-") as temporary:
        root = Path(temporary)
        builder = root / "builder"
        environment = root / "consumer"
        wheel_dir = root / "dist"
        source = root / "source"
        copytree(
            PACKAGE_ROOT,
            source,
            ignore=ignore_patterns(
                "build",
                "dist",
                "*.egg-info",
                "__pycache__",
                "*.pyc",
            ),
        )
        venv.EnvBuilder(with_pip=True, clear=True).create(builder)
        builder_python = builder / (
            "Scripts/python.exe" if sys.platform == "win32" else "bin/python"
        )
        subprocess.run(
            [
                str(builder_python),
                "-m",
                "pip",
                "wheel",
                "--disable-pip-version-check",
                "--no-deps",
                "--wheel-dir",
                str(wheel_dir),
                str(source),
            ],
            check=True,
        )
        wheels = sorted(wheel_dir.glob("*.whl"))
        if len(wheels) != 1:
            raise RuntimeError(f"expected one built wheel, found: {wheels!r}")

        wheel = wheels[0]
        with ZipFile(wheel) as archive:
            members = set(archive.namelist())
        required_members = {
            "runfold/event/__init__.py",
            "runfold/event/py.typed",
        }
        if not required_members.issubset(members):
            raise RuntimeError(
                f"wheel is missing Runfold namespace files: "
                f"{sorted(required_members - members)!r}"
            )
        for notice in ("LICENSE", "NOTICE.md"):
            packaged = any(
                member.endswith(f".dist-info/licenses/{notice}")
                for member in members
            )
            if not packaged:
                raise RuntimeError(f"wheel is missing packaged legal notice: {notice}")
        legacy_members = sorted(
            member for member in members if member.startswith("perix_event/")
        )
        if legacy_members:
            raise RuntimeError(
                f"wheel still contains the legacy perix_event package: {legacy_members!r}"
            )

        venv.EnvBuilder(with_pip=True, clear=True).create(environment)
        python = environment / (
            "Scripts/python.exe" if sys.platform == "win32" else "bin/python"
        )
        subprocess.run(
            [
                str(python),
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "--no-index",
                str(wheel),
            ],
            check=True,
        )
        consumer = """
import json
import sys
from pathlib import Path

import runfold.event

persistence = runfold.event.JsonlSessionPersistence(sys.argv[1], compression="none")
writer = runfold.event.SessionStore(persistence)
session = writer.create("installed")
session.append("turn/start", {"turn": 1})
session.append("turn/end", {"turn": 1, "reason": {"kind": "completed"}})
writer.close()

resumed_store = runfold.event.SessionStore(persistence)
resumed = resumed_store.resume("installed")
resumed.append("turn/start", {"turn": 2})
resumed.append("turn/end", {"turn": 2, "reason": {"kind": "completed"}})
resumed_store.fork(resumed, child_session_id="installed-child")
resumed_store.close()

print(json.dumps({
    "version": runfold.event.__version__,
    "events": len(persistence.load("installed").events),
    "parent": persistence.load("installed-child").meta["parentSession"],
    "modulePath": str(Path(runfold.event.__file__).resolve()),
}))
"""
        output = subprocess.check_output(
            [
                str(python),
                "-c",
                consumer,
                str(root / "sessions"),
            ],
            text=True,
        )
        result = json.loads(output)
        module_path = Path(result.pop("modulePath"))
        if result != {"version": "0.1.0", "events": 5, "parent": "installed"}:
            raise RuntimeError(f"unexpected installed package result: {result!r}")
        if environment.resolve() not in module_path.parents:
            raise RuntimeError(
                f"package was not imported from the consumer environment: {module_path}"
            )
        if PACKAGE_ROOT.resolve() in module_path.parents:
            raise RuntimeError(
                f"consumer imported package from the source tree: {module_path}"
            )
        print(f"Python wheel consumer verified: {wheel.name}")


if __name__ == "__main__":
    main()
