"""Lossless DSH-compatible packing for assistant delta chunk runs."""

from __future__ import annotations

from typing import Any, Iterable, Mapping, Sequence

from ._json import MAX_SAFE_INTEGER, is_safe_integer, snapshot_json_value
from .errors import EventValidationError
from .types import SessionEvent


MIN_RUN = 3
_ROW_TYPES = frozenset({"text-chunks", "reasoning-chunks", "tool-call-chunks"})


def _exact_keys(value: Mapping[str, Any], keys: Sequence[str]) -> bool:
    return len(value) == len(keys) and set(value) == set(keys)


def _is_number(value: Any) -> bool:
    return type(value) is int or type(value) is float


def _classify(event: Mapping[str, Any]) -> str | None:
    if event.get("type") != "assistant/chunk":
        return None
    if not _exact_keys(event, ("type", "seq", "time", "data")):
        return None
    if not is_safe_integer(event.get("seq"), non_negative=True):
        return None
    if not is_safe_integer(event.get("time")):
        return None
    data = event.get("data")
    if type(data) is not dict or not _exact_keys(data, ("turn", "step", "chunk")):
        return None
    if not _is_number(data.get("turn")) or not _is_number(data.get("step")):
        return None
    chunk = data.get("chunk")
    if type(chunk) is not dict or not _is_number(chunk.get("index")):
        return None
    chunk_type = chunk.get("type")
    if chunk_type in ("text-delta", "reasoning-delta"):
        if _exact_keys(chunk, ("type", "index", "text")) and type(chunk.get("text")) is str:
            return chunk_type
        return None
    if chunk_type == "tool-call-delta":
        base = _exact_keys(chunk, ("type", "index", "id", "argumentsDelta"))
        named = _exact_keys(chunk, ("type", "index", "id", "name", "argumentsDelta"))
        if not base and not (named and type(chunk.get("name")) is str):
            return None
        if type(chunk.get("id")) is str and type(chunk.get("argumentsDelta")) is str:
            return chunk_type
    return None


def _continues(previous: Mapping[str, Any], current: Mapping[str, Any], kind: str) -> bool:
    if int(current["seq"]) != int(previous["seq"]) + 1:
        return False
    gap = int(current["time"]) - int(previous["time"])
    if abs(gap) > MAX_SAFE_INTEGER:
        return False
    left = previous["data"]
    right = current["data"]
    if right["turn"] != left["turn"] or right["step"] != left["step"]:
        return False
    if right["chunk"]["index"] != left["chunk"]["index"]:
        return False
    if kind != "tool-call-delta":
        return True
    a = left["chunk"]
    b = right["chunk"]
    return (
        a["id"] == b["id"]
        and ("name" in a) == ("name" in b)
        and a.get("name") == b.get("name")
    )


def _build_row(kind: str, run: Sequence[SessionEvent]) -> dict[str, Any]:
    first = run[0]
    base = {
        "turn": first["data"]["turn"],
        "step": first["data"]["step"],
        "index": first["data"]["chunk"]["index"],
        "dt": [int(event["time"]) - int(run[index]["time"]) for index, event in enumerate(run[1:])],
    }
    envelope = {"seq0": int(first["seq"]), "time0": int(first["time"])}
    if kind == "tool-call-delta":
        call = first["data"]["chunk"]
        data = {
            **base,
            "id": call["id"],
            **({"name": call["name"]} if "name" in call else {}),
            "args": [event["data"]["chunk"]["argumentsDelta"] for event in run],
        }
        return {"type": "tool-call-chunks", **envelope, "data": data}
    data = {
        **base,
        "texts": [event["data"]["chunk"]["text"] for event in run],
    }
    return {
        "type": "text-chunks" if kind == "text-delta" else "reasoning-chunks",
        **envelope,
        "data": data,
    }


def pack_chunk_runs(events: Iterable[SessionEvent]) -> list[dict[str, Any]]:
    """Pack eligible consecutive runs; pass every other Event through verbatim."""

    output: list[dict[str, Any]] = []
    kind: str | None = None
    run: list[SessionEvent] = []

    def flush() -> None:
        nonlocal kind, run
        if kind is not None and len(run) >= MIN_RUN:
            output.append(_build_row(kind, run))
        else:
            output.extend(snapshot_json_value(run))
        kind = None
        run = []

    for event in events:
        candidate = _classify(event)
        if candidate is None:
            flush()
            output.append(snapshot_json_value(event))
            continue
        if candidate == kind and run and _continues(run[-1], event, candidate):
            run.append(snapshot_json_value(event))
            continue
        flush()
        kind = candidate
        run = [snapshot_json_value(event)]
    flush()
    return output


def _malformed(tag: str, reason: str) -> None:
    raise EventValidationError(f"malformed {tag} storage row: {reason}")


def _validate_run_data(tag: str, data: Mapping[str, Any], payload_key: str) -> list[str]:
    if not all(_is_number(data.get(key)) for key in ("turn", "step", "index")):
        _malformed(tag, "turn/step/index must be numbers")
    payload = data.get(payload_key)
    if type(payload) is not list or not payload or any(type(entry) is not str for entry in payload):
        _malformed(tag, f"{payload_key} must be a non-empty string array")
    gaps = data.get("dt")
    if type(gaps) is not list or any(not is_safe_integer(gap) for gap in gaps):
        _malformed(tag, "dt must be an array of safe integers")
    if len(gaps) != len(payload) - 1:
        _malformed(tag, f"dt length {len(gaps)} does not match {len(payload)} members")
    return payload


def _validate_row(value: Mapping[str, Any], tag: str) -> dict[str, Any]:
    if not _exact_keys(value, ("type", "seq0", "time0", "data")):
        _malformed(tag, "envelope must be exactly {type, seq0, time0, data}")
    if not is_safe_integer(value.get("seq0"), non_negative=True):
        _malformed(tag, "seq0 must be a non-negative safe integer")
    if not is_safe_integer(value.get("time0")):
        _malformed(tag, "time0 must be a safe integer")
    data = value.get("data")
    if type(data) is not dict:
        _malformed(tag, "data must be an object")
    if tag == "tool-call-chunks":
        with_name = _exact_keys(data, ("turn", "step", "index", "id", "name", "dt", "args"))
        if not with_name and not _exact_keys(
            data, ("turn", "step", "index", "id", "dt", "args")
        ):
            _malformed(tag, "data must be exactly {turn, step, index, id, name?, dt, args}")
        if type(data.get("id")) is not str or (with_name and type(data.get("name")) is not str):
            _malformed(tag, "id (and name when present) must be strings")
        payload = _validate_run_data(tag, data, "args")
    else:
        if not _exact_keys(data, ("turn", "step", "index", "dt", "texts")):
            _malformed(tag, "data must be exactly {turn, step, index, dt, texts}")
        payload = _validate_run_data(tag, data, "texts")
    if len(payload) - 1 > MAX_SAFE_INTEGER - int(value["seq0"]):
        _malformed(tag, "member seqs must stay safe integers")
    timestamp = int(value["time0"])
    for gap in data["dt"]:
        timestamp += int(gap)
        if abs(timestamp) > MAX_SAFE_INTEGER:
            _malformed(tag, "member times must stay safe integers")
    return snapshot_json_value(value)


def _expand_row(row: Mapping[str, Any]) -> list[SessionEvent]:
    tag = row["type"]
    data = row["data"]
    members = data["args"] if tag == "tool-call-chunks" else data["texts"]
    timestamp = int(row["time0"])
    events: list[SessionEvent] = []
    for index, member in enumerate(members):
        if index:
            timestamp += int(data["dt"][index - 1])
        if tag == "text-chunks":
            chunk = {"type": "text-delta", "index": data["index"], "text": member}
        elif tag == "reasoning-chunks":
            chunk = {"type": "reasoning-delta", "index": data["index"], "text": member}
        else:
            chunk = {
                "type": "tool-call-delta",
                "index": data["index"],
                "id": data["id"],
                **({"name": data["name"]} if "name" in data else {}),
                "argumentsDelta": member,
            }
        events.append(
            {
                "type": "assistant/chunk",
                "seq": int(row["seq0"]) + index,
                "time": timestamp,
                "data": {"turn": data["turn"], "step": data["step"], "chunk": chunk},
            }
        )
    return events


def decode_storage_record(value: Any) -> list[SessionEvent]:
    """Expand one packed storage row, or return a non-row value verbatim."""

    if type(value) is not dict or value.get("type") not in _ROW_TYPES:
        return [value]
    return _expand_row(_validate_row(value, value["type"]))


def _strictly_increasing(values: Sequence[int]) -> bool:
    return all(index == 0 or value > values[index - 1] for index, value in enumerate(values))


def encode_seq_ranges(values: Sequence[int]) -> list[int | list[int]]:
    """Range-encode profitable consecutive provenance runs."""

    if not _strictly_increasing(values):
        return list(values)
    encoded: list[int | list[int]] = []
    start = 0
    while start < len(values):
        end = start
        while end + 1 < len(values) and values[end + 1] == values[end] + 1:
            end += 1
        if end - start >= 2:
            encoded.append([values[start], values[end]])
        else:
            encoded.extend(values[start : end + 1])
        start = end + 1
    return encoded


def decode_seq_ranges(value: Any, max_entries: int = MAX_SAFE_INTEGER) -> list[int]:
    """Expand storage-form provenance, rejecting malformed ranges."""

    if type(value) is not list:
        raise EventValidationError("sourceEventSeqs must be an array")
    decoded: list[int] = []
    has_range = False
    for entry in value:
        if is_safe_integer(entry, non_negative=True):
            if len(decoded) >= max_entries:
                raise EventValidationError("sourceEventSeqs exceeds its event sequence")
            decoded.append(int(entry))
            continue
        if type(entry) is not list or len(entry) != 2:
            raise EventValidationError(
                "sourceEventSeqs range entries must be [start, end] pairs"
            )
        start, end = entry
        if not is_safe_integer(start, non_negative=True) or not is_safe_integer(
            end, non_negative=True
        ):
            raise EventValidationError(
                "sourceEventSeqs must contain non-negative safe integers"
            )
        start_int = int(start)
        end_int = int(end)
        if end_int < start_int:
            raise EventValidationError("sourceEventSeqs ranges require start <= end")
        length = end_int - start_int + 1
        if length > max_entries - len(decoded):
            raise EventValidationError("sourceEventSeqs range exceeds its event sequence")
        decoded.extend(range(start_int, end_int + 1))
        has_range = True
    if has_range and not _strictly_increasing(decoded):
        raise EventValidationError("sourceEventSeqs ranges must be strictly increasing")
    return decoded
