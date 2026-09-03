"""DSH-compatible JSONL wire format and path layout."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from ._json import is_safe_integer, json_dumps, json_loads, snapshot_json_value
from .chunk_rows import (
    decode_seq_ranges,
    decode_storage_record,
    encode_seq_ranges,
    pack_chunk_runs,
)
from .errors import EventValidationError, SessionFormatUnsupportedError
from .types import SESSION_FORMAT_VERSION, SessionEvent, SessionHeader


def log_suffix(compression: str) -> str:
    if compression == "zstd":
        return ".jsonl.zstd"
    if compression == "none":
        return ".jsonl"
    raise ValueError(f"unsupported JSONL compression: {compression}")


def to_header_line(header: SessionHeader) -> dict[str, Any]:
    line: dict[str, Any] = {
        "type": "session",
        "version": header["version"],
        "id": header["id"],
        "createdAt": header["createdAt"],
    }
    for key in ("cwd", "parentSession", "seedLength", "origin"):
        if key in header:
            line[key] = header[key]
    line["delegationDepth"] = header.get("delegationDepth", 0)
    if "agentPreset" in header:
        line["agentPreset"] = header["agentPreset"]
    return line


def from_header_line(line: dict[str, Any]) -> SessionHeader:
    if "sandboxMode" in line or "approvalPolicy" in line:
        raise EventValidationError("session header uses retired policy baseline fields")
    header: SessionHeader = {
        "version": int(line["version"]),
        "id": line["id"],
        "createdAt": int(line["createdAt"]),
    }
    for key in ("cwd", "parentSession", "seedLength", "origin"):
        if key in line:
            header[key] = line[key]
    header["delegationDepth"] = int(line["delegationDepth"])
    if "agentPreset" in line:
        header["agentPreset"] = line["agentPreset"]
    return header


def _is_header_line(value: Any) -> bool:
    return (
        type(value) is dict
        and value.get("type") == "session"
        and is_safe_integer(value.get("version"))
        and type(value.get("id")) is str
        and is_safe_integer(value.get("createdAt"), non_negative=True)
        and is_safe_integer(value.get("delegationDepth"), non_negative=True)
        and ("origin" not in value or value["origin"] == "subagent")
        and ("agentPreset" not in value or type(value["agentPreset"]) is str)
    )


def encode_segment(raw: str) -> str:
    """Encode a Python string exactly as DSH encodes JavaScript UTF-16 units."""

    if raw == "":
        raise ValueError("cannot encode an empty path segment")
    if raw == ".":
        return "~002E"
    if raw == "..":
        return "~002E~002E"
    encoded = raw.encode("utf-16-le", errors="surrogatepass")
    output: list[str] = []
    for offset in range(0, len(encoded), 2):
        unit = int.from_bytes(encoded[offset : offset + 2], "little")
        char = chr(unit)
        if char != "~" and (
            "A" <= char <= "Z"
            or "a" <= char <= "z"
            or "0" <= char <= "9"
            or char in "._-"
        ):
            output.append(char)
        else:
            output.append(f"~{unit:04X}")
    return "".join(output)


def project_key(cwd: str) -> str:
    if cwd == "":
        raise ValueError("cannot encode an empty project path")
    encoded = cwd.encode("utf-16-le", errors="surrogatepass")
    output: list[str] = []
    separator_run = False
    for offset in range(0, len(encoded), 2):
        unit = int.from_bytes(encoded[offset : offset + 2], "little")
        char = chr(unit)
        if char in "/\\:":
            if not separator_run:
                output.append("-")
            separator_run = True
        elif char != "~" and (
            "A" <= char <= "Z"
            or "a" <= char <= "z"
            or "0" <= char <= "9"
            or char in "._-"
        ):
            output.append(char)
            separator_run = False
        else:
            output.append(f"~{unit:04X}")
            separator_run = False
    slug = "".join(output).lstrip("-") or "root"
    return f"--{slug[:251]}--"


def project_dir(root: Path, cwd: str | None) -> Path:
    return root / ("_no-cwd" if cwd is None else project_key(cwd))


def session_dir(root: Path, cwd: str | None, session_id: str) -> Path:
    return project_dir(root, cwd) / encode_segment(session_id)


def log_path(root: Path, cwd: str | None, session_id: str, compression: str) -> Path:
    return session_dir(root, cwd, session_id) / f"session{log_suffix(compression)}"


def _encode_provenance(record: dict[str, Any]) -> dict[str, Any]:
    if "sourceEventSeqs" not in record:
        return record
    result = snapshot_json_value(record)
    result["sourceEventSeqs"] = encode_seq_ranges(result["sourceEventSeqs"])
    return result


def _expand_provenance(parsed: Any) -> dict[str, Any]:
    if type(parsed) is not dict:
        raise EventValidationError("stored session records must be objects")
    if "sourceEventSeqs" not in parsed:
        return parsed
    if not is_safe_integer(parsed.get("seq"), non_negative=True):
        raise EventValidationError(
            "stored session event seq must be a non-negative safe integer"
        )
    result = snapshot_json_value(parsed)
    result["sourceEventSeqs"] = decode_seq_ranges(
        result["sourceEventSeqs"], int(result["seq"])
    )
    return result


def event_lines(events: Iterable[SessionEvent], pack_chunks: bool = True) -> str:
    materialized = list(events)
    records = pack_chunk_runs(materialized) if pack_chunks else snapshot_json_value(materialized)
    return "\n".join(json_dumps(_encode_provenance(record)) for record in records)


def _version_refusal(session_id: str, version: int) -> str:
    if version > SESSION_FORMAT_VERSION:
        return (
            f'session "{session_id}" uses log format v{version}, but this SDK reads only '
            f"v{SESSION_FORMAT_VERSION}: the log was written by a newer implementation — "
            "upgrade the Event SDK to open it"
        )
    return (
        f'session "{session_id}" uses log format v{version}, older than the supported '
        f"v{SESSION_FORMAT_VERSION}, and this build ships no upgrade path for it"
    )


def _parse_header_record(record: bytes) -> SessionHeader:
    if not record or not record.endswith(b"\n") or b"\n" in record[:-1]:
        raise EventValidationError("empty or header-less session log")
    try:
        parsed = json_loads(record[:-1])
    except (UnicodeDecodeError, ValueError) as error:
        raise EventValidationError(
            "corrupt session log: header line is not valid JSON"
        ) from error
    if type(parsed) is dict and is_safe_integer(parsed.get("version")):
        version = int(parsed["version"])
        if version != SESSION_FORMAT_VERSION:
            raise SessionFormatUnsupportedError(
                _version_refusal(str(parsed.get("id")), version)
            )
    if not _is_header_line(parsed):
        raise EventValidationError(
            "corrupt session log: first line is not a session header"
        )
    return from_header_line(parsed)


@dataclass(frozen=True)
class SessionLogScan:
    meta: SessionHeader
    events: tuple[SessionEvent, ...]
    committed_bytes: int


class SessionLogScanner:
    """Incremental scanner that preserves the last valid committed prefix."""

    def __init__(self, header_record: bytes) -> None:
        self._meta = _parse_header_record(header_record)
        self._events: list[SessionEvent] = []
        self._pending = bytearray()
        self._pending_start = len(header_record)
        self._input_bytes = len(header_record)
        self._committed_bytes = len(header_record)
        self._event_line = 0
        self._issue: Exception | None = None
        self._finished = False

    def write(self, chunk: bytes) -> None:
        if self._finished:
            raise EventValidationError("cannot write to a finished session log scanner")
        self._pending.extend(chunk)
        self._input_bytes += len(chunk)
        while True:
            try:
                newline = self._pending.index(0x0A)
            except ValueError:
                break
            line = bytes(self._pending[:newline])
            end_byte = self._pending_start + newline + 1
            del self._pending[: newline + 1]
            self._pending_start = end_byte
            self._consume_event_line(line, end_byte)

    def checkpoint(self) -> tuple[int, int, int]:
        return self._input_bytes, self._committed_bytes, len(self._events)

    def finish(self) -> SessionLogScan:
        self._finished = True
        return SessionLogScan(
            snapshot_json_value(self._meta),
            tuple(snapshot_json_value(self._events)),
            self._committed_bytes,
        )

    def _consume_event_line(self, line: bytes, end_byte: int) -> None:
        self._event_line += 1
        try:
            parsed = json_loads(line)
            decoded = decode_storage_record(_expand_provenance(parsed))
        except Exception:
            if self._issue is None:
                self._issue = EventValidationError(
                    "corrupt session log: unparsable committed event at line "
                    f"{self._event_line}"
                )
            return

        if self._issue is not None:
            if any(type(event) is dict and event.get("type") == "turn/end" for event in decoded):
                raise self._issue
            return

        row_start = len(self._events)
        for event in decoded:
            if type(event) is not dict or event.get("seq") != len(self._events):
                expected = len(self._events)
                del self._events[row_start:]
                self._issue = EventValidationError(
                    "corrupt session log: seq gap in committed region at line "
                    f"{self._event_line} (expected {expected}, got "
                    f"{event.get('seq') if type(event) is dict else None})"
                )
                if any(
                    type(candidate) is dict and candidate.get("type") == "turn/end"
                    for candidate in decoded
                ):
                    raise self._issue
                return
            self._events.append(event)
        self._committed_bytes = end_byte


def scan_log(buffer: bytes) -> SessionLogScan:
    header_end = buffer.find(b"\n")
    if header_end == -1:
        raise EventValidationError("empty or header-less session log")
    scanner = SessionLogScanner(buffer[: header_end + 1])
    scanner.write(buffer[header_end + 1 :])
    return scanner.finish()


def parse_header_meta(first_line: str) -> SessionHeader | None:
    try:
        parsed = json_loads(first_line)
    except ValueError:
        return None
    if not _is_header_line(parsed):
        return None
    return from_header_line(parsed)
