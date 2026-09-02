"""Perix native Python Event SDK."""

from .chunk_rows import (
    decode_seq_ranges,
    decode_storage_record,
    encode_seq_ranges,
    pack_chunk_runs,
)
from .errors import (
    EventError,
    EventValidationError,
    SessionForkError,
    SessionFormatUnsupportedError,
    SessionNotFoundError,
    SessionPersistenceCorruptionError,
    SessionPersistenceError,
)
from .format import (
    encode_segment,
    event_lines,
    log_path,
    log_suffix,
    parse_header_meta,
    project_dir,
    project_key,
    scan_log,
    session_dir,
)
from .messages import (
    CONTEXT_SUMMARY_MAX_CHARS,
    bound_context_summary,
    create_assistant_message,
    create_message,
    create_tool_result_message,
    create_user_message,
    freeze_message,
)
from .persistence_jsonl import JsonlSessionPersistence
from .repair import TOOL_NOT_STARTED, TOOL_OUTCOME_UNKNOWN, interrupted_turn_closers
from .request_header import (
    call_config_equals,
    canonical_header,
    fold_request_header,
    header_equals,
)
from .session import Session, SessionStore, validate_session_event, validate_session_header
from .surface import (
    SurfaceFoldResult,
    SurfaceManager,
    SurfaceReplacement,
    derive_event_message,
    fold_surface,
    is_append_surface_event,
    is_replacement_surface_event,
    is_surface_eligible_type,
    is_surface_event,
)
from .types import (
    KNOWN_SESSION_EVENT_TYPES,
    SESSION_FORMAT_VERSION,
    Message,
    SessionEvent,
    SessionHeader,
    SessionInspection,
    SessionLocation,
    SessionRawArtifact,
)


__version__ = "0.1.0"

__all__ = [
    "CONTEXT_SUMMARY_MAX_CHARS",
    "EventError",
    "EventValidationError",
    "JsonlSessionPersistence",
    "KNOWN_SESSION_EVENT_TYPES",
    "Message",
    "SESSION_FORMAT_VERSION",
    "Session",
    "SessionEvent",
    "SessionForkError",
    "SessionFormatUnsupportedError",
    "SessionHeader",
    "SessionInspection",
    "SessionLocation",
    "SessionNotFoundError",
    "SessionPersistenceCorruptionError",
    "SessionPersistenceError",
    "SessionRawArtifact",
    "SessionStore",
    "SurfaceFoldResult",
    "SurfaceManager",
    "SurfaceReplacement",
    "TOOL_NOT_STARTED",
    "TOOL_OUTCOME_UNKNOWN",
    "bound_context_summary",
    "call_config_equals",
    "canonical_header",
    "create_assistant_message",
    "create_message",
    "create_tool_result_message",
    "create_user_message",
    "decode_seq_ranges",
    "decode_storage_record",
    "derive_event_message",
    "encode_segment",
    "encode_seq_ranges",
    "event_lines",
    "fold_request_header",
    "fold_surface",
    "freeze_message",
    "header_equals",
    "interrupted_turn_closers",
    "is_append_surface_event",
    "is_replacement_surface_event",
    "is_surface_eligible_type",
    "is_surface_event",
    "log_path",
    "log_suffix",
    "pack_chunk_runs",
    "parse_header_meta",
    "project_dir",
    "project_key",
    "scan_log",
    "session_dir",
    "validate_session_event",
    "validate_session_header",
]
