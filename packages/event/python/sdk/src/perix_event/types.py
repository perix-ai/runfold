"""Language-neutral Event type aliases and immutable result envelopes."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, TypeAlias


SESSION_FORMAT_VERSION = 0

JsonPrimitive: TypeAlias = None | bool | int | float | str
JsonValue: TypeAlias = JsonPrimitive | list["JsonValue"] | dict[str, "JsonValue"]
SessionHeader: TypeAlias = dict[str, Any]
SessionEvent: TypeAlias = dict[str, Any]
Message: TypeAlias = dict[str, Any]


@dataclass(frozen=True)
class SessionInspection:
    """Detached header and balanced logical Event history."""

    meta: SessionHeader
    events: tuple[SessionEvent, ...]


@dataclass(frozen=True)
class SessionRawArtifact:
    """Backend-owned logical JSONL artifact."""

    meta: SessionHeader
    filename: str
    content: str


@dataclass(frozen=True)
class SessionLocation:
    """Physical location of one backend artifact."""

    kind: str
    path: Path


# The DSH vocabulary understood by the pinned Event format. Most plugin events
# remain opaque to core; knowing their names only prevents a false refusal when
# a required record is loaded and preserved verbatim.
KNOWN_SESSION_EVENT_TYPES = frozenset(
    {
        "agent-preset/selected",
        "agent/inbox/spliced",
        "approval/asked",
        "approval/decided",
        "approval/policy",
        "assistant/chunk",
        "assistant/message",
        "command/done",
        "command/run",
        "compaction/end",
        "compaction/prune",
        "compaction/start",
        "compaction/summary",
        "feedback/record",
        "goal/change",
        "hook/invoked",
        "hook/result",
        "llm/retry",
        "llm/retry-started",
        "model/selection",
        "permission/preset",
        "plan/mode",
        "request/context",
        "request/header",
        "sandbox/mode",
        "schedule/change",
        "session-log-deepseek/delivery-accepted",
        "session/end-seed",
        "session/title",
        "session/title-llm-request",
        "step/end",
        "step/start",
        "subagent/descriptor",
        "subagent/model-selection-policy",
        "team/member",
        "team/message/delivered",
        "team/message/queued",
        "team/task",
        "todo/write",
        "tool-workflow/agent-end",
        "tool-workflow/agent-start",
        "tool-workflow/run-end",
        "tool-workflow/run-start",
        "tool/call",
        "tool/code-dispatch",
        "tool/code-dispatch-start",
        "tool/result",
        "turn/end",
        "turn/start",
        "user/message",
        "web/deepseek-search-llm-request",
    }
)
