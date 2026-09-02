from __future__ import annotations

import sys
from pathlib import Path


EVENT_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
SDK_SOURCE = EVENT_ROOT / "sdk" / "src"

if str(SDK_SOURCE) not in sys.path:
    sys.path.insert(0, str(SDK_SOURCE))
