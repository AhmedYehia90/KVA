# Black Box Replay

Black Box Replay reconstructs a flight from the immutable KVA Event Platform.

## Source of truth

The replay reads domain events linked to a flight booking. It does not edit,
replace or reorder source events.

## v1.0 capabilities

- Flight archive
- Deterministic event timeline
- Time between checkpoints
- Payload and metadata inspection
- Correlation and causation inspection
- Projector processing status
- Source-to-projection integrity checks
- Investigation notes
- Audited JSON export

## Integrity checks

- `flight.booked` origin exists
- The projection's last event is present in the source stream
- Replayed status matches projected status
- No unhealthy projector processing records
- No unresolved causation links

## Access

The operations replay console is available only to authorized operations
administrators:

`/operations/replay`

## Boundaries

Black Box Replay reconstructs platform-recorded operational events. Simulator
telemetry, control inputs and high-frequency positional recording require a
future telemetry integration and are not silently invented by this release.
