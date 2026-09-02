"""Ordered model-visible surface derived from the append-only Event log."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence

from ._json import is_safe_integer, snapshot_json_value
from .errors import EventValidationError
from .types import Message, SessionEvent


SURFACE_EVENT_TYPES = frozenset({"user/message", "assistant/message", "tool/result"})


@dataclass(frozen=True)
class SurfaceReplacement:
    seq: int
    start: int
    end: int
    shadowed_seqs: tuple[int, ...]


@dataclass(frozen=True)
class SurfaceFoldResult:
    nodes: tuple[int, ...]
    replacements: tuple[SurfaceReplacement, ...]


def is_surface_eligible_type(event_type: str) -> bool:
    return event_type in SURFACE_EVENT_TYPES


def is_surface_event(event: Mapping[str, Any]) -> bool:
    return event.get("type") in SURFACE_EVENT_TYPES and "surfaceOp" in event


def is_append_surface_event(event: Mapping[str, Any]) -> bool:
    return is_surface_event(event) and event.get("surfaceOp") == "append"


def is_replacement_surface_event(event: Mapping[str, Any]) -> bool:
    return is_surface_event(event) and event.get("surfaceOp") != "append"


def derive_event_message(event: Mapping[str, Any]) -> Message | None:
    """Project one surface Event to its provider-neutral message."""

    event_type = event.get("type")
    if event_type == "user/message":
        return snapshot_json_value(event["data"])
    if event_type == "assistant/message":
        message = event["data"]["message"]
        if len(message["content"]) == 0:
            return None
        return snapshot_json_value(message)
    if event_type == "tool/result":
        return snapshot_json_value(event["data"]["message"])
    return None


def _replace_op(value: Any) -> dict[str, int] | None:
    if type(value) is not dict or set(value) != {"op", "start", "end"}:
        return None
    if value.get("op") != "replace":
        return None
    if not is_safe_integer(value.get("start"), non_negative=True):
        return None
    if not is_safe_integer(value.get("end"), non_negative=True):
        return None
    return {"op": "replace", "start": int(value["start"]), "end": int(value["end"])}


def _surface_op(event: Mapping[str, Any]) -> str | dict[str, int] | None:
    event_type = event.get("type")
    if event_type not in SURFACE_EVENT_TYPES:
        if "surfaceOp" in event:
            raise EventValidationError(
                f'session event "{event_type}" is not surface-eligible and cannot carry surfaceOp'
            )
        if "sourceEventSeqs" in event:
            raise EventValidationError(
                f'session event "{event_type}" is not surface-eligible and cannot carry sourceEventSeqs'
            )
        return None
    if "surfaceOp" not in event:
        raise EventValidationError(
            f'session event "{event_type}" is surface-eligible and requires a surfaceOp marker'
        )
    operation = event["surfaceOp"]
    if operation == "append":
        return "append"
    if type(operation) is not dict:
        raise EventValidationError(f'session event "{event_type}" carries an invalid surfaceOp')
    replacement = _replace_op(operation)
    if replacement is None:
        raise EventValidationError(
            f'session event "{event_type}" carries an invalid replace surfaceOp'
        )
    return replacement


def _assert_provenance(event: Mapping[str, Any], shadowed: Sequence[int]) -> None:
    raw = event.get("sourceEventSeqs") if "sourceEventSeqs" in event else None
    sources: set[int] = set()
    if "sourceEventSeqs" in event:
        if type(raw) is not list:
            raise EventValidationError(
                f'sourceEventSeqs on event at seq {event["seq"]} must be an array when present'
            )
        if not raw and event.get("type") != "assistant/message":
            raise EventValidationError(
                "sourceEventSeqs must not be empty except on assistant/message"
            )
        normalized: list[int] = []
        for source in raw:
            if not is_safe_integer(source, non_negative=True):
                raise EventValidationError(
                    f'session event "{event.get("type")}" sourceEventSeqs must densely '
                    "contain non-negative safe integers"
                )
            source_int = int(source)
            normalized.append(source_int)
            sources.add(source_int)
            if source_int >= int(event["seq"]):
                raise EventValidationError(
                    f"sourceEventSeqs must reference earlier events: {source_int} >= "
                    f'current seq {event["seq"]}'
                )
        if len(sources) != len(normalized):
            raise EventValidationError("sourceEventSeqs must not contain duplicates")
    missing = [seq for seq in shadowed if seq not in sources]
    if missing:
        rendered = ", ".join(str(seq) for seq in missing)
        raise EventValidationError(
            "surface replace: sourceEventSeqs must include every shadowed surface node; "
            f"missing {rendered}"
        )


def _replacement_range(nodes: Sequence[int], operation: Mapping[str, int]) -> tuple[int, int, list[int]]:
    start = operation["start"]
    end = operation["end"]
    try:
        start_index = nodes.index(start)
    except ValueError as error:
        raise EventValidationError(
            f"surface replace: start seq {start} not found in surface"
        ) from error
    try:
        end_index = nodes.index(end)
    except ValueError as error:
        raise EventValidationError(
            f"surface replace: end seq {end} not found in surface"
        ) from error
    if start_index > end_index:
        raise EventValidationError(
            f"surface replace: start seq {start} (index {start_index}) is after "
            f"end seq {end} (index {end_index})"
        )
    return start_index, end_index, list(nodes[start_index : end_index + 1])


def _assert_tool_result_rewrite(
    event: Mapping[str, Any],
    shadowed: Sequence[int],
    events: Sequence[SessionEvent],
) -> None:
    if event.get("type") != "tool/result":
        return
    if len(shadowed) != 1:
        raise EventValidationError(
            "tool/result surface replacement must rewrite exactly one current node"
        )
    original = events[shadowed[0]]
    if original.get("type") != "tool/result":
        raise EventValidationError(
            "tool/result surface replacement must target a current tool/result"
        )
    original_data = snapshot_json_value(original["data"])
    replacement_data = snapshot_json_value(event["data"])
    original_data["message"]["content"][0]["content"] = None
    replacement_data["message"]["content"][0]["content"] = None
    if original_data != replacement_data:
        raise EventValidationError("tool/result surface replacement may change only content")


def _plan(
    nodes: Sequence[int],
    event: Mapping[str, Any],
    expected_seq: int,
    events: Sequence[SessionEvent],
) -> dict[str, Any] | None:
    if event.get("seq") != expected_seq:
        raise EventValidationError(
            f'session event seq {event.get("seq")} is not contiguous; expected {expected_seq}'
        )
    operation = _surface_op(event)
    if operation is None:
        return None
    if operation == "append":
        _assert_provenance(event, ())
        return {"kind": "append", "seq": int(event["seq"])}
    start_index, end_index, shadowed = _replacement_range(nodes, operation)
    _assert_provenance(event, shadowed)
    _assert_tool_result_rewrite(event, shadowed, events)
    return {
        "kind": "replace",
        "seq": int(event["seq"]),
        "start": operation["start"],
        "end": operation["end"],
        "startIndex": start_index,
        "endIndex": end_index,
        "shadowed": shadowed,
    }


def _apply(nodes: list[int], plan: Mapping[str, Any] | None) -> SurfaceReplacement | None:
    if plan is None:
        return None
    if plan["kind"] == "append":
        nodes.append(plan["seq"])
        return None
    nodes[plan["startIndex"] : plan["endIndex"] + 1] = [plan["seq"]]
    return SurfaceReplacement(
        seq=plan["seq"],
        start=plan["start"],
        end=plan["end"],
        shadowed_seqs=tuple(plan["shadowed"]),
    )


def fold_surface(events: Iterable[SessionEvent]) -> SurfaceFoldResult:
    """Replay all surface operations in contiguous Event order."""

    materialized = list(events)
    nodes: list[int] = []
    replacements: list[SurfaceReplacement] = []
    for index, event in enumerate(materialized):
        replacement = _apply(nodes, _plan(nodes, event, index, materialized[:index]))
        if replacement is not None:
            replacements.append(replacement)
    return SurfaceFoldResult(tuple(nodes), tuple(replacements))


class SurfaceManager:
    """Incremental surface validator owned by one Session."""

    def __init__(self) -> None:
        self._nodes: list[int] = []
        self._replace_generation = 0

    @property
    def nodes(self) -> tuple[int, ...]:
        return tuple(self._nodes)

    @property
    def replace_generation(self) -> int:
        return self._replace_generation

    def accept(self, event: SessionEvent, prior_events: Sequence[SessionEvent]) -> None:
        plan = _plan(self._nodes, event, len(prior_events), prior_events)
        replacement = _apply(self._nodes, plan)
        if replacement is not None:
            self._replace_generation += 1
