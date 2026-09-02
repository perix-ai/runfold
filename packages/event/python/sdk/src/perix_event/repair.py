"""Deterministic crash-tail repair matching DSH Session behavior."""

from __future__ import annotations

from collections import OrderedDict
from typing import Any, Iterable

from ._json import snapshot_json_value
from .types import SessionEvent


TOOL_NOT_STARTED = "TOOL_NOT_STARTED"
TOOL_OUTCOME_UNKNOWN = "TOOL_OUTCOME_UNKNOWN"

_STARTED_TEXT = (
    "The tool call was interrupted after it was recorded, but no result was durably "
    "recorded. Its outcome is unknown. Decide whether to retry from the tool semantics: "
    "retry only if the operation is read-only or idempotent; if it may have side effects, "
    "first verify external state or ask the user. Do not retry blindly."
)
_NOT_STARTED_TEXT = (
    "The tool call was interrupted before the Harness recorded it as started. "
    "Retry it if it is still needed."
)


def interrupted_turn_closers(events: Iterable[SessionEvent]) -> list[SessionEvent]:
    """Return synthetic tool/step/turn events that balance an open tail turn."""

    materialized = list(events)
    open_turn: int | None = None
    open_step: int | None = None
    pending: OrderedDict[str, dict[str, int]] = OrderedDict()

    for event in materialized:
        event_type = event.get("type")
        data = event.get("data", {})
        if event_type == "turn/start":
            open_turn = data["turn"]
            open_step = None
            pending.clear()
        elif event_type == "turn/end":
            open_turn = None
            open_step = None
            pending.clear()
        elif event_type == "step/start":
            open_step = data["step"]
        elif event_type == "step/end":
            pending.clear()
            open_step = None
        elif event_type == "assistant/message":
            for block in data["message"]["content"]:
                if isinstance(block, dict) and block.get("type") == "tool-call":
                    pending[block["id"]] = {"step": data["step"]}
        elif event_type == "tool/call":
            entry = pending.get(data["callId"])
            if entry is not None:
                entry["callSeq"] = event["seq"]
        elif event_type == "tool/result":
            pending.pop(data["message"]["source"]["callId"], None)

    if open_turn is None or not materialized:
        return []

    sequence = int(materialized[-1]["seq"]) + 1
    timestamp = int(materialized[-1]["time"])
    closers: list[SessionEvent] = []

    for call_id, details in pending.items():
        started = "callSeq" in details
        message = {
            "id": f"interrupted-tool-result-{call_id}-{sequence}",
            "role": "user",
            "source": {"kind": "tool", "callId": call_id},
            "content": [
                {
                    "type": "tool-result",
                    "toolCallId": call_id,
                    "isError": True,
                    "content": [
                        {"type": "text", "text": _STARTED_TEXT if started else _NOT_STARTED_TEXT}
                    ],
                }
            ],
        }
        event: SessionEvent = {
            "type": "tool/result",
            "seq": sequence,
            "time": timestamp,
            "data": {
                "turn": open_turn,
                "step": details["step"],
                "message": message,
                "error": (
                    {"name": "ToolOutcomeUnknownError", "code": TOOL_OUTCOME_UNKNOWN}
                    if started
                    else {"name": "ToolNotStartedError", "code": TOOL_NOT_STARTED}
                ),
            },
            "surfaceOp": "append",
        }
        if started:
            event["sourceEventSeqs"] = [details["callSeq"]]
        closers.append(snapshot_json_value(event))
        sequence += 1

    if open_step is not None:
        closers.append(
            {
                "type": "step/end",
                "seq": sequence,
                "time": timestamp,
                "data": {"turn": open_turn, "step": open_step},
            }
        )
        sequence += 1
    closers.append(
        {
            "type": "turn/end",
            "seq": sequence,
            "time": timestamp,
            "data": {"turn": open_turn, "reason": {"kind": "interrupted"}},
        }
    )
    return snapshot_json_value(closers)
