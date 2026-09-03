"""Public Event error types."""

from __future__ import annotations

from pathlib import Path


class EventError(Exception):
    """Base class for Event SDK failures."""


class EventValidationError(EventError, ValueError):
    """An Event, Session header, or transition violates the contract."""


class SessionForkError(EventError):
    """A requested fork cannot be created from the selected boundary."""

    def __init__(self, message: str, code: str) -> None:
        super().__init__(message)
        self.code = code


class SessionPersistenceError(EventError):
    """Base class for durable Event storage failures."""


class SessionNotFoundError(SessionPersistenceError, LookupError):
    """No materialized Session exists for an id."""

    def __init__(self, session_id: str) -> None:
        super().__init__(f'session "{session_id}" not found')
        self.session_id = session_id


class SessionPersistenceCorruptionError(SessionPersistenceError):
    """Stored bytes were readable but do not form a valid Event log."""


class SessionFormatUnsupportedError(SessionPersistenceError):
    """The log is intact but this SDK cannot interpret its format."""

    def __init__(self, message: str, location: Path | None = None) -> None:
        super().__init__(message)
        self.location = location
