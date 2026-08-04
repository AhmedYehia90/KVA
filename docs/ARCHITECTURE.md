# KVA Architecture

## Style
- Modular monolith first
- Event-driven domain integration
- API-first external integration
- Multi-airline ready
- Single source of truth
- Versioned contracts
- Idempotent event consumers

## Layers
Core, Business Engines, Intelligence, Experience, Integrations.

## Rule
Modules do not call each other's internal tables or private logic directly. They publish and consume versioned domain events or documented service boundaries.
