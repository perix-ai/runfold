"""Native Python Event Session and in-memory SessionStore."""

from __future__ import annotations

import logging
import os
import time
from collections.abc import Mapping, Sequence
from typing import Any, Protocol

from ._json import JsonValueError, is_safe_integer, snapshot_json_value
from .errors import EventValidationError, SessionForkError
from .request_header import fold_request_header
from .surface import SurfaceManager, derive_event_message
from .types import SESSION_FORMAT_VERSION, SessionEvent, SessionHeader, SessionInspection


LOGGER = logging.getLogger(__name__)
_MISSING = object()
_EVENT_KEYS = frozenset(
    {"type", "seq", "time", "data", "surfaceOp", "sourceEventSeqs", "ignorable"}
)
_ADAPTER_DEFAULT_KEYS = frozenset({"reasoningEffort", "maxTokens"})


class SessionPersistenceBinding(Protocol):
    """Direct composition boundary used instead of the DSH Cordis runtime."""

    def attach_new(self, session: "Session") -> None: ...

    def attach_restored(self, session: "Session", persisted_length: int) -> None: ...

    def flush(self, session: "Session") -> None: ...

    def load(self, session_id: str) -> SessionInspection: ...

    def detach(self, session: "Session") -> None: ...


def _now_ms() -> int:
    return int(time.time() * 1000)


def _provider_model(value: Any) -> bool:
    return (
        type(value) is dict
        and type(value.get("provider")) is str
        and bool(value["provider"])
        and type(value.get("model")) is str
        and bool(value["model"])
    )


def _validate_adapter_defaults(value: Any, config: Mapping[str, Any], index: int) -> None:
    if value is _MISSING:
        return
    if type(value) is not dict:
        raise EventValidationError(
            f"seed request/header at index {index} has invalid adapterDefaults"
        )
    if (
        any(key not in _ADAPTER_DEFAULT_KEYS for key in value)
        or any(marker is not True for marker in value.values())
        or (value.get("reasoningEffort") is True and "reasoningEffort" not in config)
        or (value.get("maxTokens") is True and "maxTokens" not in config)
    ):
        raise EventValidationError(
            f"seed request/header at index {index} has invalid adapterDefaults"
        )


def _assert_message_shape(event: Mapping[str, Any], subject: str) -> None:
    event_type = event.get("type")
    if event_type not in {"user/message", "assistant/message", "tool/result"}:
        return
    data = event.get("data")
    record = data if type(data) is dict else None
    message = record if event_type == "user/message" else record.get("message") if record else None
    if type(message) is not dict or type(message.get("id")) is not str or not message["id"]:
        raise EventValidationError(f"{subject} lacks an identified message")
    expected_role = "assistant" if event_type == "assistant/message" else "user"
    if message.get("role") != expected_role:
        raise EventValidationError(f'{subject} message must have role "{expected_role}"')
    source = message.get("source")
    if type(source) is not dict or type(source.get("kind")) is not str or not source["kind"]:
        raise EventValidationError(f"{subject} message has invalid source")
    if type(message.get("content")) is not list:
        raise EventValidationError(f"{subject} message has invalid content")
    if event_type == "assistant/message":
        if source.get("kind") != "model" or not _provider_model(source):
            raise EventValidationError(f"{subject} message must have model source")
        return
    if event_type != "tool/result":
        return
    if source.get("kind") != "tool" or type(source.get("callId")) is not str or not source["callId"]:
        raise EventValidationError(f"{subject} message must have tool source")
    content = message["content"]
    block = content[0] if content else None
    if (
        len(content) != 1
        or type(block) is not dict
        or block.get("type") != "tool-result"
        or type(block.get("content")) is not list
    ):
        raise EventValidationError(f"{subject} message must contain one tool-result block")
    if block.get("toolCallId") != source["callId"]:
        raise EventValidationError(f"{subject} message has mismatched tool call ids")


def _assert_current_llm_shape(event: Mapping[str, Any], index: int) -> None:
    data = event.get("data")
    record = data if type(data) is dict else None
    if event.get("type") == "request/header":
        header = record.get("header") if record else None
        header_record = header if type(header) is dict else None
        config = header_record.get("config") if header_record else None
        if not _provider_model(config):
            raise EventValidationError(f"seed request/header at index {index} lacks provider/model")
        reasoning = config.get("reasoningEffort", _MISSING)
        if reasoning is not _MISSING and (type(reasoning) is not str or not reasoning):
            raise EventValidationError(
                f"seed request/header at index {index} has an invalid reasoningEffort"
            )
        _validate_adapter_defaults(
            header_record.get("adapterDefaults", _MISSING), config, index
        )
    _assert_message_shape(event, f'seed {event.get("type")} at index {index}')


def _assert_supported_request_header(event_type: str, data: Any, location: str) -> None:
    if event_type == "request/header-delta":
        raise EventValidationError(
            f"{location} uses unsupported legacy request/header-delta format"
        )
    if (
        event_type == "request/header"
        and type(data) is dict
        and data.get("reason") == "fallback"
    ):
        raise EventValidationError(
            f'{location} uses unsupported legacy request/header reason "fallback"'
        )


def validate_session_header(session_id: str, value: Any) -> SessionHeader:
    """Validate and detach one DSH-compatible Session header."""

    try:
        record = snapshot_json_value(value)
    except JsonValueError as error:
        raise EventValidationError("session header is not losslessly JSON-serializable") from error
    if type(record) is not dict:
        raise EventValidationError("session header is not a plain JSON record")
    version = record.get("version")
    if not is_safe_integer(version) or int(version) != SESSION_FORMAT_VERSION:
        raise EventValidationError(
            f"session header version must be {SESSION_FORMAT_VERSION}, got {version}"
        )
    if record.get("id") != session_id:
        raise EventValidationError(
            f'session header id "{record.get("id")}" does not match session id "{session_id}"'
        )
    created_at = record.get("createdAt")
    if not is_safe_integer(created_at, non_negative=True):
        raise EventValidationError(
            "session header createdAt must be a non-negative safe integer"
        )
    cwd = record.get("cwd", _MISSING)
    if cwd is not _MISSING:
        if type(cwd) is not str:
            raise EventValidationError("session header cwd must be a string")
        if not os.path.isabs(cwd):
            raise EventValidationError(f'session header cwd must be an absolute path, got "{cwd}"')
    parent = record.get("parentSession", _MISSING)
    if parent is not _MISSING and type(parent) is not str:
        raise EventValidationError("session header parentSession must be a string")
    seed_length = record.get("seedLength", _MISSING)
    if seed_length is not _MISSING and not is_safe_integer(seed_length, non_negative=True):
        raise EventValidationError(
            "session header seedLength must be a non-negative safe integer"
        )
    origin = record.get("origin", _MISSING)
    if origin is not _MISSING and origin != "subagent":
        raise EventValidationError('session header origin must be "subagent"')
    depth = record.get("delegationDepth", _MISSING)
    if depth is not _MISSING and not is_safe_integer(depth, non_negative=True):
        raise EventValidationError(
            "session header delegationDepth must be a non-negative safe integer"
        )
    preset = record.get("agentPreset", _MISSING)
    if preset is not _MISSING and type(preset) is not str:
        raise EventValidationError("session header agentPreset must be a string")
    record["version"] = int(version)
    record["createdAt"] = int(created_at)
    if seed_length is not _MISSING:
        record["seedLength"] = int(seed_length)
    if depth is not _MISSING:
        record["delegationDepth"] = int(depth)
    return record


def validate_session_event(value: Any, index: int) -> SessionEvent:
    """Validate, normalize, and detach one stored Event envelope."""

    try:
        event = snapshot_json_value(value)
    except JsonValueError as error:
        raise EventValidationError(
            f"seed event at index {index} is not losslessly JSON-serializable"
        ) from error
    if type(event) is not dict or any(key not in _EVENT_KEYS for key in event):
        raise EventValidationError(f"seed event at index {index} has an invalid event envelope")
    if event.get("type") == "request/header-delta":
        raise EventValidationError(
            f"seed event at index {index} uses unsupported legacy request/header-delta format"
        )
    if (
        type(event.get("type")) is not str
        or not is_safe_integer(event.get("seq"), non_negative=True)
        or not is_safe_integer(event.get("time"))
        or "data" not in event
        or ("ignorable" in event and event["ignorable"] is not True)
    ):
        raise EventValidationError(f"seed event at index {index} has an invalid event envelope")
    event["seq"] = int(event["seq"])
    event["time"] = int(event["time"])
    if event["type"] in {"request/header", "user/message", "assistant/message", "tool/result"}:
        _assert_current_llm_shape(event, index)
    _assert_supported_request_header(
        event["type"], event["data"], f"seed event at index {index}"
    )
    return event


class Session:
    """Append-only native Python Event Session."""

    def __init__(
        self,
        session_id: str,
        seed: Sequence[SessionEvent] | None = None,
        header: SessionHeader | None = None,
    ) -> None:
        if type(session_id) is not str:
            raise EventValidationError("session id must be a string")
        self._events: list[SessionEvent] = []
        self._surface = SurfaceManager()
        self._appending = False
        self._header_fold: dict[str, Any] | None = None
        self._header_fold_seq = 0
        self._context_fold: dict[str, Any] | None = None
        self._context_fold_seq = 0

        if seed is not None:
            for index, source in enumerate(seed):
                event = validate_session_event(source, index)
                if event["seq"] != index:
                    raise EventValidationError(
                        f'seed event at index {index} has seq {event["seq"]} '
                        f"(expected {index}); seed must be contiguous from 0"
                    )
                try:
                    self._surface.accept(event, self._events)
                except EventValidationError as error:
                    raise EventValidationError(
                        f"invalid seed event at index {index}: {error}"
                    ) from error
                self._events.append(event)
        self.first_live_seq = len(self._events)
        source_header = header if header is not None else {
            "version": SESSION_FORMAT_VERSION,
            "id": session_id,
            "createdAt": _now_ms(),
        }
        self._header = validate_session_header(session_id, source_header)
        if seed is not None and (
            not self._events or self._events[-1]["type"] != "session/end-seed"
        ):
            self.append("session/end-seed", {})

    @classmethod
    def create(
        cls,
        session_id: str,
        seed: Sequence[SessionEvent] | None = None,
        header: SessionHeader | None = None,
    ) -> "Session":
        return cls(session_id, seed, header)

    @classmethod
    def from_restore(
        cls,
        session_id: str,
        seed: Sequence[SessionEvent],
        header: SessionHeader,
    ) -> "Session":
        return cls(session_id, seed, header)

    @property
    def id(self) -> str:
        return self._header["id"]

    @property
    def header(self) -> SessionHeader:
        return snapshot_json_value(self._header)

    @property
    def events(self) -> tuple[SessionEvent, ...]:
        return tuple(snapshot_json_value(self._events))

    @property
    def seq(self) -> int:
        return len(self._events)

    @property
    def surface(self) -> SurfaceManager:
        return self._surface

    def append(
        self,
        event_type: str,
        data: Any,
        *,
        surface_op: str | Mapping[str, Any] | object = _MISSING,
        source_event_seqs: Sequence[int] | object = _MISSING,
        ignorable: bool = False,
    ) -> SessionEvent:
        """Append one detached, validated Event and return its snapshot."""

        if type(event_type) is not str:
            raise EventValidationError("session event type must be a string")
        try:
            data_snapshot = snapshot_json_value(data)
        except JsonValueError as error:
            raise EventValidationError(
                f'session event "{event_type}" carries non-JSON-serializable data'
            ) from error
        _assert_supported_request_header(
            event_type, data_snapshot, f'session event "{event_type}"'
        )
        event: SessionEvent = {
            "type": event_type,
            "seq": len(self._events),
            "time": _now_ms(),
            "data": data_snapshot,
        }
        if surface_op is not _MISSING:
            try:
                event["surfaceOp"] = snapshot_json_value(surface_op)
            except JsonValueError as error:
                raise EventValidationError(
                    f'session event "{event_type}" carries non-JSON-serializable surface metadata'
                ) from error
        if source_event_seqs is not _MISSING:
            try:
                event["sourceEventSeqs"] = snapshot_json_value(list(source_event_seqs))
            except (JsonValueError, TypeError) as error:
                raise EventValidationError(
                    f'session event "{event_type}" carries non-JSON-serializable surface metadata'
                ) from error
        if ignorable:
            event["ignorable"] = True
        if self._appending:
            raise EventValidationError(
                "session append cannot reenter while another append is being published"
            )
        _assert_message_shape(event, f'session event "{event_type}"')
        self._surface.accept(event, self._events)
        self._appending = True
        try:
            self._events.append(event)
        finally:
            self._appending = False
        return snapshot_json_value(event)

    def request_header(self) -> dict[str, Any] | None:
        if self._header_fold_seq < len(self._events):
            self._header_fold = fold_request_header(
                self._events[self._header_fold_seq :], self._header_fold
            )
            self._header_fold_seq = len(self._events)
        return snapshot_json_value(self._header_fold) if self._header_fold is not None else None

    def request_context(self) -> dict[str, Any] | None:
        if self._context_fold_seq < len(self._events):
            for event in self._events[self._context_fold_seq :]:
                if event["type"] == "request/context":
                    self._context_fold = snapshot_json_value(event["data"])
            self._context_fold_seq = len(self._events)
        return snapshot_json_value(self._context_fold) if self._context_fold is not None else None

    def derive_messages(self) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = []
        for sequence in self._surface.nodes:
            message = derive_event_message(self._events[sequence])
            if message is not None:
                messages.append(message)
        return messages

    def derive_event_message(self, event: Mapping[str, Any]) -> dict[str, Any] | None:
        return derive_event_message(event)

    def _storage_events(self) -> tuple[SessionEvent, ...]:
        """Package-private detached snapshot for persistence."""

        return self.events


class SessionStore:
    """In-memory Session registry with direct optional persistence composition."""

    def __init__(self, persistence: SessionPersistenceBinding | None = None) -> None:
        self._sessions: dict[str, Session] = {}
        self._counter = 0
        self.persistence = persistence

    def _next_id(self) -> str:
        while True:
            self._counter += 1
            candidate = f"session-{self._counter}"
            if candidate not in self._sessions:
                return candidate

    def create(
        self,
        session_id: str | None = None,
        *,
        seed: Sequence[SessionEvent] | None = None,
        meta: Mapping[str, Any] | None = None,
    ) -> Session:
        identity = self._next_id() if session_id is None else session_id
        if identity in self._sessions:
            raise EventValidationError(f'session "{identity}" already exists')
        metadata = dict(meta or {})
        allowed_meta = {
            "cwd",
            "parentSession",
            "createdAt",
            "seedLength",
            "origin",
            "delegationDepth",
            "agentPreset",
        }
        unknown = set(metadata) - allowed_meta
        if unknown:
            raise EventValidationError(
                f"unsupported session metadata fields: {', '.join(sorted(unknown))}"
            )
        header: SessionHeader = {
            "version": SESSION_FORMAT_VERSION,
            "id": identity,
            "createdAt": metadata.pop("createdAt", _now_ms()),
            **metadata,
        }
        session = Session.create(identity, seed, header)
        if self.persistence is not None:
            self.persistence.attach_new(session)
        self._sessions[identity] = session
        return session

    def get(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    def list(self) -> list[Session]:
        return list(self._sessions.values())

    def restore(self, session_id: str) -> Session:
        if self.persistence is None:
            raise EventValidationError("cannot restore without configured persistence")
        if session_id in self._sessions:
            raise EventValidationError(f'session "{session_id}" already exists')
        inspection = self.persistence.load(session_id)
        session = Session.from_restore(session_id, inspection.events, inspection.meta)
        self.persistence.attach_restored(session, len(inspection.events))
        self._sessions[session_id] = session
        return session

    def resume(self, session_id: str) -> Session:
        """Restore a persisted Session and continue its append lifecycle."""

        return self.restore(session_id)

    def flush(self, session: Session | str) -> None:
        if self.persistence is None:
            return
        target = self._resolve_live(session)
        self.persistence.flush(target)

    def fork(
        self,
        source: Session | str,
        boundary: int | None = None,
        child_session_id: str | None = None,
    ) -> Session:
        if child_session_id is not None and child_session_id in self._sessions:
            raise SessionForkError(
                f'session "{child_session_id}" already exists', "SESSION_ALREADY_EXISTS"
            )
        parent = self._resolve_fork_source(source)
        events = list(parent.events)
        if boundary is None:
            if not events:
                seed: list[SessionEvent] = []
            else:
                boundary = events[-1]["seq"]
                seed = self._fork_seed(parent, events, boundary)
        else:
            seed = self._fork_seed(parent, events, boundary)
        meta: dict[str, Any] = {
            "parentSession": parent.id,
            "seedLength": len(seed),
        }
        if "cwd" in parent.header:
            meta["cwd"] = parent.header["cwd"]
        return self.create(child_session_id, seed=seed, meta=meta)

    def _fork_seed(
        self, session: Session, events: list[SessionEvent], boundary: Any
    ) -> list[SessionEvent]:
        if not is_safe_integer(boundary, non_negative=True):
            raise SessionForkError(
                f'fork boundary for session "{session.id}" must be a non-negative '
                f"safe integer, got {boundary}",
                "INVALID_BOUNDARY",
            )
        boundary = int(boundary)
        if boundary >= len(events):
            last = events[-1]["seq"] if events else "none"
            raise SessionForkError(
                f'fork boundary {boundary} does not exist in session "{session.id}" '
                f"(last seq: {last})",
                "INVALID_BOUNDARY",
            )
        if events[boundary]["seq"] != boundary:
            raise SessionForkError(
                f'fork boundary {boundary} does not match a contiguous event seq in '
                f'session "{session.id}"',
                "INVALID_BOUNDARY",
            )
        last_boundary: SessionEvent | None = None
        for event in events[: boundary + 1]:
            if event["type"] in {"turn/start", "turn/end"}:
                last_boundary = event
        if last_boundary is not None and last_boundary["type"] == "turn/start":
            raise SessionForkError(
                f'fork boundary {boundary} in session "{session.id}" ends inside '
                f'open turn {last_boundary["data"]["turn"]}',
                "OPEN_TURN",
            )
        return events[: boundary + 1]

    def _resolve_live(self, source: Session | str) -> Session:
        if isinstance(source, str):
            session = self._sessions.get(source)
            if session is None:
                raise EventValidationError(f'session "{source}" not found')
            return session
        live = self._sessions.get(source.id)
        if live is not source:
            raise EventValidationError(f'session "{source.id}" is not the live store instance')
        return source

    def _resolve_fork_source(self, source: Session | str) -> Session:
        if isinstance(source, str):
            session = self._sessions.get(source)
            if session is None:
                raise SessionForkError(f'session "{source}" not found', "SESSION_NOT_FOUND")
            return session
        live = self._sessions.get(source.id)
        if live is None:
            raise SessionForkError(f'session "{source.id}" not found', "SESSION_NOT_FOUND")
        if live is not source:
            raise SessionForkError(
                f'session "{source.id}" is not the live store instance', "SESSION_NOT_LIVE"
            )
        return source

    def close(self) -> None:
        for session in list(self._sessions.values()):
            try:
                self.flush(session)
                if self.persistence is not None:
                    self.persistence.detach(session)
            except Exception:
                LOGGER.exception('failed to flush session "%s" during store close', session.id)
                raise
        self._sessions.clear()

    def __enter__(self) -> "SessionStore":
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        self.close()
