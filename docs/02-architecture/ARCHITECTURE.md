# Architecture

## Style
- Modular monolith first
- Event-driven domain integration
- API-first external integration
- Multi-airline ready
- Single source of truth
- Versioned contracts
- Idempotent consumers

## Layers
Core → Business Engines → Intelligence → Experience → Integrations

Modules communicate through documented service boundaries and domain events, never through private internals.
