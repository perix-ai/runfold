# Conformance Cases

Cases describe observable behavior that every conformant implementation must
provide. A case definition should contain:

- a stable case ID and referenced invariant;
- preconditions and canonical input;
- the operation being exercised;
- expected output and durable records;
- allowed implementation variance;
- cleanup requirements, if any.

The initial groups are `identity`, `stream`, `event`, `state`, `checkpoint`,
`artifact`, `effect` and `projection`. Cases should not depend on a particular
database, process model or wire protocol.
