from __future__ import annotations

import sys
from pathlib import Path


EVENT_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
PACKAGE_SOURCE = EVENT_ROOT / "src"

if str(PACKAGE_SOURCE) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SOURCE))
