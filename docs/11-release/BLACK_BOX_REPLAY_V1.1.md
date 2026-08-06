# Black Box Replay v1.1 — Lineage Integrity Fix

## Corrected

- Future flight events reuse one flight correlation ID.
- Every event after `flight.booked` points to the immediately preceding event.
- Replay integrity now detects:
  - Multiple correlations
  - Missing causation
  - Unexpected causation
  - Broken causation references
- Investigation-note events are excluded from the operational flight chain.

## Historical events

Existing events are not rewritten. Older flights with incomplete lineage are
shown honestly as `Integrity warning`. A newly created flight after this
migration should pass the strict lineage checks.
