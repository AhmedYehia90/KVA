# Black Box Replay v1.2 — Durable Stream Order

## Corrected

PostgreSQL `now()` is fixed for the duration of a transaction. Events created
by one booking or completion transaction could therefore share identical
timestamps, leaving UUID order to determine replay order.

v1.2 adds a durable monotonic `stream_position` to `platform_events`.

## Results

- Events created in one transaction retain their actual insertion order.
- The origin event is identified deterministically.
- Causation checks compare against the true preceding event.
- Future events use one correlation ID and immediate causation.
- Existing KVA201 may become healthy when its recorded links match the restored
  business order; otherwise it remains an honest historical warning.
