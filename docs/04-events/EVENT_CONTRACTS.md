# Event Contracts

Every production event contract defines:
- Event type using `domain.action`
- Integer version beginning at 1
- Producer
- Consumers
- Payload schema
- Privacy classification
- Compatibility and migration policy

## Compatibility
A breaking payload change requires a new event version. Existing consumers must continue to process supported historical versions during replay.
