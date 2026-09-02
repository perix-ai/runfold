"""Standalone DSH-compatible JSONL Session persistence."""

from __future__ import annotations

import os
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from . import _zstd
from ._json import is_safe_integer, snapshot_json_value
from .errors import (
    EventValidationError,
    SessionFormatUnsupportedError,
    SessionNotFoundError,
    SessionPersistenceCorruptionError,
)
from .format import (
    SessionLogScanner,
    event_lines,
    log_path,
    log_suffix,
    parse_header_meta,
    project_dir,
    scan_log,
    session_dir,
    to_header_line,
)
from .repair import interrupted_turn_closers
from .session import Session, validate_session_header
from .types import (
    KNOWN_SESSION_EVENT_TYPES,
    SESSION_FORMAT_VERSION,
    SessionEvent,
    SessionHeader,
    SessionInspection,
    SessionLocation,
    SessionRawArtifact,
)


@dataclass
class _Binding:
    session: Session
    cursor: int
    materialized: bool


@dataclass(frozen=True)
class _TornMarker:
    truncate_to: int
    recovered_events: tuple[SessionEvent, ...]


@dataclass(frozen=True)
class _StoredPrefix:
    path: Path
    meta: SessionHeader
    events: tuple[SessionEvent, ...]
    revision: tuple[int, int, int, int, int]
    torn_marker: _TornMarker | None = None


class _RevisionChanged(RuntimeError):
    pass


def _revision(stat: os.stat_result) -> tuple[int, int, int, int, int]:
    return (stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns)


def _sync_directory(path: Path) -> None:
    if os.name != "posix":
        return
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


class JsonlSessionPersistence:
    """One append-only JSONL artifact per Session, without a server/runtime."""

    supports_raw_artifacts = True

    def __init__(
        self,
        root: str | os.PathLike[str],
        *,
        pack_chunks: bool = True,
        compression: str = "zstd",
    ) -> None:
        if compression not in {"zstd", "none"}:
            raise ValueError('compression must be "zstd" or "none"')
        if compression == "zstd" and not _zstd.available():
            raise _zstd.ZstdUnavailableError(
                "Zstandard support requires Python 3.14+ or the 'perix-event-sdk[zstd]' extra"
            )
        self.root = Path(root).expanduser().resolve()
        self.pack_chunks = pack_chunks
        self.compression = compression
        if self.root.exists() and not self.root.is_dir():
            raise NotADirectoryError(self.root)
        self._bindings: dict[str, _Binding] = {}
        self._locks_guard = threading.Lock()
        self._locks: dict[str, threading.RLock] = {}

    def _lock(self, session_id: str) -> threading.RLock:
        with self._locks_guard:
            return self._locks.setdefault(session_id, threading.RLock())

    def locate(self, header: SessionHeader) -> SessionLocation:
        return SessionLocation(
            "jsonl",
            log_path(
                self.root,
                header.get("cwd"),
                header["id"],
                self.compression,
            ),
        )

    def attach_new(self, session: Session) -> None:
        with self._lock(session.id):
            if session.id in self._bindings:
                raise EventValidationError(
                    f'session "{session.id}" already has a persistence owner'
                )
            if self._find_log(session.id) is not None:
                raise EventValidationError(
                    f'refusing to create "{session.id}": a log already exists on disk '
                    "(load/resume it instead)"
                )
            self._bindings[session.id] = _Binding(session, 0, False)

    def attach_restored(self, session: Session, persisted_length: int) -> None:
        with self._lock(session.id):
            if session.id in self._bindings:
                raise EventValidationError(
                    f'session "{session.id}" already has a persistence owner'
                )
            if self._find_log(session.id) is None:
                raise SessionNotFoundError(session.id)
            self._bindings[session.id] = _Binding(
                session, persisted_length, True
            )

    def flush(self, session: Session) -> None:
        with self._lock(session.id):
            binding = self._bindings.get(session.id)
            if binding is None or binding.session is not session:
                raise EventValidationError(
                    f'session "{session.id}" is not attached to this persistence backend'
                )
            events = list(session._storage_events())
            if binding.cursor > len(events):
                raise SessionPersistenceCorruptionError(
                    f'persistence cursor for "{session.id}" exceeds the live log'
                )
            batch = events[binding.cursor :]
            if not batch:
                return
            if binding.materialized:
                self._append_batch(session.header, batch)
            else:
                self._materialize(session.header, batch)
                binding.materialized = True
            binding.cursor = len(events)

    def detach(self, session: Session) -> None:
        """Release one exact live persistence owner after its final flush."""

        with self._lock(session.id):
            binding = self._bindings.get(session.id)
            if binding is None:
                return
            if binding.session is not session:
                raise EventValidationError(
                    f'session "{session.id}" is not the live persistence owner'
                )
            self._bindings.pop(session.id, None)

    def ensure_materialized(self, session: Session) -> None:
        with self._lock(session.id):
            binding = self._bindings.get(session.id)
            if binding is None or binding.session is not session:
                raise EventValidationError(
                    f'session "{session.id}" is not attached to this persistence backend'
                )
            if binding.materialized:
                return
            self._materialize(session.header, [])
            binding.materialized = True

    def load(self, session_id: str) -> SessionInspection:
        with self._lock(session_id):
            binding = self._bindings.get(session_id)
            if binding is not None:
                self.flush(binding.session)
                events = list(binding.session.events)
                if interrupted_turn_closers(events):
                    raise EventValidationError(
                        f'cannot load session "{session_id}" while its live turn is open; '
                        "use the live Session or wait for the turn to close"
                    )
                if not events and not binding.materialized:
                    raise SessionNotFoundError(session_id)
                return SessionInspection(binding.session.header, tuple(events))
            return self._cold_inspection(session_id, commit_repair=True)

    def inspect(self, session_id: str) -> SessionInspection:
        with self._lock(session_id):
            binding = self._bindings.get(session_id)
            if binding is not None:
                return SessionInspection(binding.session.header, binding.session.events)
            return self._cold_inspection(session_id, commit_repair=False)

    def read_from(self, session_id: str, from_seq: int) -> SessionInspection:
        if not is_safe_integer(from_seq, non_negative=True):
            raise ValueError("from_seq must be a non-negative safe integer")
        with self._lock(session_id):
            prefix = self._load_stored(session_id)
            self._validate_prefix(prefix)
            return SessionInspection(
                snapshot_json_value(prefix.meta),
                tuple(snapshot_json_value(list(prefix.events[int(from_seq) :]))),
            )

    def read_raw(self, session_id: str) -> SessionRawArtifact | None:
        with self._lock(session_id):
            path = self._find_log(session_id)
            if path is None:
                return None
            buffer, _ = self._read_stable(path)
            if self.compression == "zstd":
                scan = _zstd.scan_frames(buffer)
                if not scan.frames:
                    raise SessionPersistenceCorruptionError(
                        "empty or header-less Zstandard session log"
                    )
                plaintext = b"".join(frame.plaintext for frame in scan.frames)
            else:
                plaintext = buffer
            try:
                content = plaintext.decode("utf-8")
            except UnicodeDecodeError as error:
                raise SessionPersistenceCorruptionError(
                    f'corrupt session log: invalid UTF-8 in "{path}"'
                ) from error
            first_line = content.split("\n", 1)[0]
            meta = parse_header_meta(first_line)
            if meta is None or meta.get("id") != session_id:
                raise SessionPersistenceCorruptionError(
                    f'corrupt session log: invalid header line in "{path}"'
                )
            return SessionRawArtifact(meta, "session.jsonl", content)

    def list(self) -> list[SessionHeader]:
        return [snapshot_json_value(header) for header, _ in self._list_artifacts()]

    def append(self, session_id: str, events: Iterable[SessionEvent]) -> None:
        """Durably append a detached batch without attaching a live Session."""

        batch = snapshot_json_value(list(events))
        if not batch:
            return
        with self._lock(session_id):
            prefix = self._load_stored(session_id)
            self._validate_prefix(prefix)
            expected = len(prefix.events)
            for index, event in enumerate(batch):
                if type(event) is not dict or event.get("seq") != expected + index:
                    raise EventValidationError(
                        f'append seq mismatch for "{session_id}": expected '
                        f"{expected + index} at index {index}, got "
                        f"{event.get('seq') if type(event) is dict else None}"
                    )
            combined = [*prefix.events, *batch]
            Session.from_restore(session_id, combined, prefix.meta)
            self._append_batch(prefix.meta, batch)

    def _cold_inspection(self, session_id: str, *, commit_repair: bool) -> SessionInspection:
        while True:
            prefix = self._load_stored(session_id)
            try:
                self._validate_prefix(prefix)
                closers = interrupted_turn_closers(prefix.events)
                balanced = [*prefix.events, *closers]
                Session.from_restore(session_id, balanced, prefix.meta)
                if commit_repair and (prefix.torn_marker is not None or closers):
                    self._commit_repair(prefix, closers)
                return SessionInspection(
                    snapshot_json_value(prefix.meta),
                    tuple(snapshot_json_value(balanced)),
                )
            except _RevisionChanged:
                continue
            except SessionFormatUnsupportedError:
                raise
            except SessionPersistenceCorruptionError:
                raise
            except Exception as error:
                raise SessionPersistenceCorruptionError(
                    f'stored session "{session_id}" failed validation: {error}'
                ) from error

    def _validate_prefix(self, prefix: _StoredPrefix) -> None:
        if prefix.meta["version"] != SESSION_FORMAT_VERSION:
            raise SessionFormatUnsupportedError(
                f'session "{prefix.meta["id"]}" uses unsupported log format '
                f'v{prefix.meta["version"]}',
                prefix.path,
            )
        for event in prefix.events:
            if event.get("type") in KNOWN_SESSION_EVENT_TYPES or event.get("ignorable") is True:
                continue
            raise SessionFormatUnsupportedError(
                f'session "{prefix.meta["id"]}" contains event type '
                f'"{event.get("type")}" (seq {event.get("seq")}) unknown to this SDK '
                "and not marked ignorable; refusing to interpret the log",
                prefix.path,
            )
        Session.from_restore(prefix.meta["id"], prefix.events, prefix.meta)

    def _load_stored(self, session_id: str) -> _StoredPrefix:
        path = self._find_log(session_id)
        if path is None:
            raise SessionNotFoundError(session_id)
        prefix = self._read_prefix(path)
        if prefix.meta.get("id") != session_id:
            raise SessionPersistenceCorruptionError(
                f'stored session identity mismatch: requested "{session_id}", '
                f'header contains "{prefix.meta.get("id")}"'
            )
        expected = log_path(
            self.root,
            prefix.meta.get("cwd"),
            prefix.meta["id"],
            self.compression,
        )
        try:
            same = path.samefile(expected)
        except FileNotFoundError:
            same = path == expected
        if not same:
            raise SessionPersistenceCorruptionError(
                f'corrupt session log "{path}": header id and cwd identify "{expected}"'
            )
        return prefix

    def _read_prefix(self, path: Path) -> _StoredPrefix:
        buffer, revision = self._read_stable(path)
        try:
            if self.compression == "none":
                scan = scan_log(buffer)
                marker = (
                    _TornMarker(scan.committed_bytes, ())
                    if scan.committed_bytes < len(buffer)
                    else None
                )
                return _StoredPrefix(
                    path,
                    scan.meta,
                    scan.events,
                    revision,
                    marker,
                )
            frame_scan = _zstd.scan_frames(buffer)
            if not frame_scan.frames:
                raise EventValidationError(
                    "empty or header-less Zstandard session log"
                )
            header = frame_scan.frames[0].plaintext
            if not header or header.find(b"\n") != len(header) - 1:
                raise EventValidationError(
                    "corrupt Zstandard session log: first frame is not exactly one header line"
                )
            scanner = SessionLogScanner(header)
            for frame in frame_scan.frames[1:]:
                scanner.write(frame.plaintext)
            input_bytes, committed_bytes, complete_count = scanner.checkpoint()
            if input_bytes != committed_bytes:
                raise EventValidationError(
                    "corrupt Zstandard session log: complete frame contains a torn JSONL record"
                )
            marker: _TornMarker | None = None
            if frame_scan.torn_start is not None:
                scanner.write(_zstd.decompress_prefix(buffer[frame_scan.torn_start :]))
                recovered = scanner.finish()
                marker = _TornMarker(
                    frame_scan.torn_start,
                    recovered.events[complete_count:],
                )
                scan = recovered
            else:
                scan = scanner.finish()
            return _StoredPrefix(path, scan.meta, scan.events, revision, marker)
        except SessionFormatUnsupportedError as error:
            if error.location is None:
                raise SessionFormatUnsupportedError(
                    f"{error} (raw log: {path})", path
                ) from error
            raise
        except Exception as error:
            if isinstance(error, SessionPersistenceCorruptionError):
                raise
            raise SessionPersistenceCorruptionError(
                f'failed to read session log "{path}": {error}'
            ) from error

    def _read_stable(self, path: Path) -> tuple[bytes, tuple[int, int, int, int, int]]:
        while True:
            before = _revision(path.stat())
            buffer = path.read_bytes()
            after = _revision(path.stat())
            if before == after:
                return buffer, after

    def _commit_repair(
        self, prefix: _StoredPrefix, closers: Iterable[SessionEvent]
    ) -> None:
        if _revision(prefix.path.stat()) != prefix.revision:
            raise _RevisionChanged
        if prefix.torn_marker is not None:
            with prefix.path.open("r+b") as handle:
                handle.truncate(prefix.torn_marker.truncate_to)
                handle.flush()
                os.fsync(handle.fileno())
        repaired = [
            *(prefix.torn_marker.recovered_events if prefix.torn_marker else ()),
            *closers,
        ]
        if repaired:
            self._append_payload_unlocked(prefix.path, repaired)

    def _materialize(
        self, header: SessionHeader, events: Iterable[SessionEvent]
    ) -> None:
        header = validate_session_header(header["id"], header)
        directory = session_dir(
            self.root, header.get("cwd"), header["id"]
        )
        final_path = log_path(
            self.root, header.get("cwd"), header["id"], self.compression
        )
        opposite = log_path(
            self.root,
            header.get("cwd"),
            header["id"],
            "none" if self.compression == "zstd" else "zstd",
        )
        self._reject_legacy_flat_artifact(directory.parent, header["id"])
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        if opposite.exists():
            raise EventValidationError(self._encoding_mismatch(opposite))
        if final_path.exists():
            raise EventValidationError(
                f'refusing to materialize "{header["id"]}": a log already exists '
                "on disk (load/resume it instead)"
            )
        content = self._encode_materialization(header, list(events))
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f"{final_path.name}.", suffix=".tmp", dir=directory
        )
        temporary = Path(temporary_name)
        try:
            os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "wb", closefd=True) as handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
            os.link(temporary, final_path)
            _sync_directory(directory)
        finally:
            temporary.unlink(missing_ok=True)

    def _append_batch(
        self, header: SessionHeader, events: Iterable[SessionEvent]
    ) -> None:
        batch = snapshot_json_value(list(events))
        if not batch:
            return
        path = log_path(
            self.root, header.get("cwd"), header["id"], self.compression
        )
        prefix = self._read_prefix(path)
        if prefix.torn_marker is not None:
            raise SessionPersistenceCorruptionError(
                f'cannot append to torn session log "{path}"; load it to repair first'
            )
        if to_header_line(prefix.meta) != to_header_line(header):
            raise SessionPersistenceCorruptionError(
                f'stored header for "{header["id"]}" does not match its live Session header'
            )
        expected = len(prefix.events)
        for index, event in enumerate(batch):
            if event.get("seq") != expected + index:
                raise EventValidationError(
                    f'append seq mismatch for "{header["id"]}": expected '
                    f'{expected + index} at index {index}, got {event.get("seq")}'
                )
        self._append_payload_unlocked(path, batch)

    def _append_payload_unlocked(
        self, path: Path, events: Iterable[SessionEvent]
    ) -> None:
        payload = self._encode_event_batch(list(events))
        with path.open("r+b") as handle:
            handle.seek(0, os.SEEK_END)
            before = handle.tell()
            try:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            except Exception:
                handle.seek(0)
                handle.truncate(before)
                handle.flush()
                os.fsync(handle.fileno())
                raise

    def _encode_materialization(
        self, header: SessionHeader, events: list[SessionEvent]
    ) -> bytes:
        from ._json import json_dumps

        header_bytes = (json_dumps(to_header_line(header)) + "\n").encode("utf-8")
        if not events:
            return (
                _zstd.compress_frame(header_bytes)
                if self.compression == "zstd"
                else header_bytes
            )
        body = (event_lines(events, self.pack_chunks) + "\n").encode("utf-8")
        if self.compression == "none":
            return header_bytes + body
        return _zstd.compress_frame(header_bytes) + _zstd.compress_frame(body)

    def _encode_event_batch(self, events: list[SessionEvent]) -> bytes:
        body = (event_lines(events, self.pack_chunks) + "\n").encode("utf-8")
        return _zstd.compress_frame(body) if self.compression == "zstd" else body

    def _find_log(self, session_id: str) -> Path | None:
        matches: list[Path] = []
        for project in self._project_directories():
            self._reject_legacy_flat_artifact(project, session_id)
            directory = project / self._encoded_id(session_id)
            if directory.is_symlink() or not directory.is_dir():
                continue
            configured = directory / f"session{log_suffix(self.compression)}"
            opposite = directory / f"session{log_suffix('none' if self.compression == 'zstd' else 'zstd')}"
            if opposite.exists():
                raise EventValidationError(self._encoding_mismatch(opposite))
            if configured.exists():
                matches.append(configured)
        if len(matches) > 1:
            raise SessionPersistenceCorruptionError(
                f'duplicate JSONL session id "{session_id}" appears in multiple project directories'
            )
        return matches[0] if matches else None

    @staticmethod
    def _encoded_id(session_id: str) -> str:
        from .format import encode_segment

        return encode_segment(session_id)

    def _list_artifacts(self) -> list[tuple[SessionHeader, Path]]:
        artifacts: list[tuple[SessionHeader, Path]] = []
        ids: set[str] = set()
        for project in self._project_directories():
            for directory in self._session_directories(project):
                configured = directory / f"session{log_suffix(self.compression)}"
                opposite = directory / f"session{log_suffix('none' if self.compression == 'zstd' else 'zstd')}"
                if opposite.exists():
                    raise EventValidationError(self._encoding_mismatch(opposite))
                if not configured.exists():
                    continue
                first = self._read_first_line(configured)
                if first is None:
                    continue
                header = parse_header_meta(first)
                if header is None:
                    continue
                expected = log_path(
                    self.root,
                    header.get("cwd"),
                    header["id"],
                    self.compression,
                )
                try:
                    same = configured.samefile(expected)
                except FileNotFoundError:
                    same = configured == expected
                if not same:
                    raise SessionPersistenceCorruptionError(
                        f'corrupt session log "{configured}": header identifies "{expected}"'
                    )
                if header["id"] in ids:
                    raise SessionPersistenceCorruptionError(
                        f'duplicate JSONL session id "{header["id"]}" appears in '
                        "multiple project directories"
                    )
                ids.add(header["id"])
                artifacts.append((header, configured))
        return artifacts

    def _project_directories(self) -> list[Path]:
        if not self.root.exists():
            return []
        return [
            entry
            for entry in self.root.iterdir()
            if not entry.is_symlink() and entry.is_dir()
        ]

    def _session_directories(self, project: Path) -> list[Path]:
        entries = list(project.iterdir())
        legacy = next(
            (
                entry
                for entry in entries
                if entry.is_file()
                and (
                    entry.name.endswith(".jsonl")
                    or entry.name.endswith(".jsonl.zstd")
                )
            ),
            None,
        )
        if legacy is not None:
            raise EventValidationError(self._legacy_layout(legacy))
        return [
            entry
            for entry in entries
            if not entry.is_symlink() and entry.is_dir()
        ]

    def _reject_legacy_flat_artifact(self, project: Path, session_id: str) -> None:
        encoded = self._encoded_id(session_id)
        for compression in ("zstd", "none"):
            path = project / f"{encoded}{log_suffix(compression)}"
            if path.exists():
                raise EventValidationError(self._legacy_layout(path))

    def _read_first_line(self, path: Path) -> str | None:
        if self.compression == "zstd":
            buffer = bytearray()
            with path.open("rb") as handle:
                while True:
                    chunk = handle.read(8192)
                    if not chunk:
                        return None
                    buffer.extend(chunk)
                    scan = _zstd.scan_frames(bytes(buffer))
                    if scan.frames:
                        plaintext = scan.frames[0].plaintext
                        if not plaintext.endswith(b"\n") or b"\n" in plaintext[:-1]:
                            return None
                        return plaintext[:-1].decode("utf-8")
        with path.open("rb") as handle:
            chunks: list[bytes] = []
            while True:
                chunk = handle.read(8192)
                if not chunk:
                    return None
                newline = chunk.find(b"\n")
                if newline >= 0:
                    chunks.append(chunk[:newline])
                    return b"".join(chunks).decode("utf-8")
                chunks.append(chunk)

    def _encoding_mismatch(self, path: Path) -> str:
        opposite = "none" if self.compression == "zstd" else "zstd"
        return (
            f"session artifact {path!s} uses {log_suffix(opposite)}, but this backend "
            f"is configured for compression {self.compression!r}; use a separate root "
            "or select the matching compression mode"
        )

    @staticmethod
    def _legacy_layout(path: Path) -> str:
        return (
            f"session artifact {path!s} uses the unsupported flat-file layout; "
            "use a separate root or move it into a project/session directory "
            "before loading"
        )

    def close(self) -> None:
        """File backend has no process-global resources to release."""

    def __enter__(self) -> "JsonlSessionPersistence":
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        self.close()
