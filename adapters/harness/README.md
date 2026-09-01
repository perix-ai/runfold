# Harness Adapters

Adapters for DeepSeek Harness, AgentScope, Deep Agents, OpenAI Agents SDK and
other harness/runtime ecosystems.

Their job is translation into Perix canonical runtime-data commands and events,
not persistence or orchestration. Source-specific identifiers and fields MUST be
preserved as namespaced metadata; they MUST NOT replace canonical IDs or alter
ordering semantics.
