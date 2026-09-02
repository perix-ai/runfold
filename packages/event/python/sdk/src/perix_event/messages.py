"""Minimal Event-owned message values and constructors."""

from __future__ import annotations

from typing import Any, Mapping, Sequence
from uuid import uuid4

from ._json import snapshot_json_value


CONTEXT_SUMMARY_MAX_CHARS = 120


def bound_context_summary(summary: str) -> str:
    """Bound a context notice to the DSH durable summary limit."""

    return summary if len(summary) <= CONTEXT_SUMMARY_MAX_CHARS else summary[:119] + "…"


def freeze_message(message: Mapping[str, Any]) -> dict[str, Any]:
    """Validate and detach an identified message."""

    return snapshot_json_value(dict(message))


def create_message(
    *,
    role: str,
    content: Sequence[Mapping[str, Any]],
    source: Mapping[str, Any],
) -> dict[str, Any]:
    """Create one provider-neutral identified message."""

    return freeze_message(
        {
            "role": role,
            "content": [dict(block) for block in content],
            "source": dict(source),
            "id": str(uuid4()),
        }
    )


def create_user_message(
    *,
    content: Sequence[Mapping[str, Any]],
    source: Mapping[str, Any],
) -> dict[str, Any]:
    """Create an identified user-role message."""

    return create_message(role="user", content=content, source=source)


def create_assistant_message(
    *,
    content: Sequence[Mapping[str, Any]],
    source: Mapping[str, Any],
) -> dict[str, Any]:
    """Create an identified model-produced assistant message."""

    return create_message(
        role="assistant",
        content=content,
        source={"kind": "model", **dict(source)},
    )


def create_tool_result_message(
    *,
    call_id: str,
    content: Sequence[Mapping[str, Any]],
    is_error: bool,
) -> dict[str, Any]:
    """Create an identified user-role tool result."""

    return create_user_message(
        source={"kind": "tool", "callId": call_id},
        content=[
            {
                "type": "tool-result",
                "toolCallId": call_id,
                "content": [dict(block) for block in content],
                "isError": is_error,
            }
        ],
    )
