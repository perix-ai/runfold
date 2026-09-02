from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import venv
from pathlib import Path


SDK = Path(__file__).resolve().parents[1] / "sdk"


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="perix-event-package-") as temporary:
        root = Path(temporary)
        environment = root / "venv"
        venv.EnvBuilder(with_pip=True, clear=True).create(environment)
        python = environment / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
        subprocess.run(
            [
                str(python),
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                str(SDK),
            ],
            check=True,
        )
        consumer = """
import json
import sys

import perix_event

persistence = perix_event.JsonlSessionPersistence(sys.argv[1], compression="none")
writer = perix_event.SessionStore(persistence)
session = writer.create("installed")
session.append("turn/start", {"turn": 1})
session.append("turn/end", {"turn": 1, "reason": {"kind": "completed"}})
writer.close()

resumed_store = perix_event.SessionStore(persistence)
resumed = resumed_store.resume("installed")
resumed.append("turn/start", {"turn": 2})
resumed.append("turn/end", {"turn": 2, "reason": {"kind": "completed"}})
resumed_store.fork(resumed, child_session_id="installed-child")
resumed_store.close()

print(json.dumps({
    "version": perix_event.__version__,
    "events": len(persistence.load("installed").events),
    "parent": persistence.load("installed-child").meta["parentSession"],
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
        if result != {"version": "0.1.0", "events": 5, "parent": "installed"}:
            raise RuntimeError(f"unexpected installed package result: {result!r}")
        print("Python package consumer verified")


if __name__ == "__main__":
    main()
