"""Request-header reconstruction over full Event snapshots."""

from __future__ import annotations

from typing import Any, Iterable, Mapping

from ._json import json_dumps, snapshot_json_value
from .types import SessionEvent


_MISSING = object()


def canonical_header(header: Mapping[str, Any]) -> dict[str, Any]:
    """Normalize empty optional fields to the DSH canonical representation."""

    config = snapshot_json_value(header["config"])
    result: dict[str, Any] = {"config": config}
    defaults = header.get("adapterDefaults")
    if isinstance(defaults, dict) and (
        defaults.get("reasoningEffort") is True or defaults.get("maxTokens") is True
    ):
        result["adapterDefaults"] = snapshot_json_value(defaults)
    system = header.get("system")
    if isinstance(system, str) and system:
        result["system"] = system
    tools = header.get("tools")
    if isinstance(tools, list) and tools:
        result["tools"] = snapshot_json_value(tools)
    return result


def call_config_equals(a: Mapping[str, Any], b: Mapping[str, Any]) -> bool:
    """Compare the exact DSH request-header call-config fields."""

    for key in ("provider", "model", "reasoningEffort", "temperature", "maxTokens"):
        if a.get(key, _MISSING) != b.get(key, _MISSING):
            return False
    left = a.get("stop", _MISSING)
    right = b.get("stop", _MISSING)
    return left == right


def header_equals(a: Mapping[str, Any], b: Mapping[str, Any]) -> bool:
    """Field-wise equality over canonical headers."""

    if not call_config_equals(a["config"], b["config"]):
        return False
    left_defaults = a.get("adapterDefaults", {})
    right_defaults = b.get("adapterDefaults", {})
    if left_defaults.get("reasoningEffort") != right_defaults.get("reasoningEffort"):
        return False
    if left_defaults.get("maxTokens") != right_defaults.get("maxTokens"):
        return False
    if a.get("system", _MISSING) != b.get("system", _MISSING):
        return False
    left_tools = a.get("tools", [])
    right_tools = b.get("tools", [])
    return len(left_tools) == len(right_tools) and all(
        json_dumps(left) == json_dumps(right)
        for left, right in zip(left_tools, right_tools)
    )


def fold_request_header(
    events: Iterable[SessionEvent],
    initial: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Return the latest canonical request header in a log or prefix."""

    state = canonical_header(initial) if initial is not None else None
    for event in events:
        if event.get("type") == "request/header":
            state = canonical_header(event["data"]["header"])
    return state
