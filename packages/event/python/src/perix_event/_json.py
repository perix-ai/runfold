"""Lossless JSON helpers matching the DSH Event acceptance boundary."""

from __future__ import annotations

import json
import math
from typing import Any


MAX_SAFE_INTEGER = 9_007_199_254_740_991


class JsonValueError(TypeError):
    """A value cannot cross the language-neutral Event JSON boundary."""


def _assign(destination: tuple[Any, Any], value: Any) -> None:
    target, key = destination
    target[key] = value


def _snapshot_number(value: int | float) -> int | float:
    if type(value) is int:
        try:
            as_float = float(value)
        except OverflowError as error:
            raise JsonValueError("integer is outside the JSON number domain") from error
        if not math.isfinite(as_float) or int(as_float) != value:
            raise JsonValueError("integer is not exactly representable as a JavaScript number")
        return value
    if type(value) is float:
        if not math.isfinite(value) or (value == 0.0 and math.copysign(1.0, value) < 0):
            raise JsonValueError("number must be finite and must not be negative zero")
        return value
    raise JsonValueError(f"unsupported number type: {type(value).__name__}")


def snapshot_json_value(value: Any) -> Any:
    """Validate and detach one acyclic plain JSON graph.

    DSH accepts only null, booleans, strings, finite non-negative-zero numbers,
    dense arrays, and plain string-keyed objects. Python integers additionally
    must have an exact IEEE-754 representation so TypeScript reads the same
    number rather than a rounded value.
    """

    root: list[Any] = [None]
    ancestors: set[int] = set()
    tasks: list[tuple[str, Any, tuple[Any, Any] | None]] = [
        ("visit", value, (root, 0)),
    ]

    while tasks:
        kind, current, destination = tasks.pop()
        if kind == "leave":
            ancestors.remove(id(current))
            continue

        if current is None or type(current) is bool or type(current) is str:
            assert destination is not None
            _assign(destination, current)
            continue
        if type(current) is int or type(current) is float:
            assert destination is not None
            _assign(destination, _snapshot_number(current))
            continue

        if type(current) is list:
            identity = id(current)
            if identity in ancestors:
                raise JsonValueError("circular JSON array")
            target: list[Any] = [None] * len(current)
            assert destination is not None
            _assign(destination, target)
            ancestors.add(identity)
            tasks.append(("leave", current, None))
            for index in range(len(current) - 1, -1, -1):
                tasks.append(("visit", current[index], (target, index)))
            continue

        if type(current) is dict:
            identity = id(current)
            if identity in ancestors:
                raise JsonValueError("circular JSON object")
            if any(type(key) is not str for key in current):
                raise JsonValueError("JSON object keys must be strings")
            target_dict: dict[str, Any] = {}
            assert destination is not None
            _assign(destination, target_dict)
            ancestors.add(identity)
            tasks.append(("leave", current, None))
            items = list(current.items())
            for key, child in reversed(items):
                tasks.append(("visit", child, (target_dict, key)))
            continue

        raise JsonValueError(f"unsupported JSON value type: {type(current).__name__}")

    return root[0]


def json_dumps(value: Any) -> str:
    """Serialize compact UTF-8 JSON after callers have validated the graph."""

    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
    )


def json_loads(value: str | bytes) -> Any:
    """Parse strict JSON, rejecting JavaScript-invalid NaN/Infinity tokens."""

    def reject_constant(token: str) -> None:
        raise ValueError(f"invalid JSON numeric constant {token}")

    return json.loads(value, parse_constant=reject_constant)


def is_safe_integer(value: Any, *, non_negative: bool = False) -> bool:
    """Whether a value obeys JavaScript's safe-integer contract."""

    if type(value) is int:
        integer = value
    elif type(value) is float and math.isfinite(value) and value.is_integer():
        if value == 0.0 and math.copysign(1.0, value) < 0:
            return False
        integer = int(value)
    else:
        return False
    return abs(integer) <= MAX_SAFE_INTEGER and (not non_negative or integer >= 0)
