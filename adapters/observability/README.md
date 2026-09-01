# Observability Adapters

Projection adapters for OpenTelemetry and related observability systems.

Observability data may be sampled, redacted or transformed and therefore must
never become the authoritative recovery source. Adapters SHOULD retain canonical
`event_id`, stream Revision and projection version as correlation attributes
where the target format permits them.
