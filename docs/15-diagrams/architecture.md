# Architecture Diagram

```mermaid
flowchart TD
  UX[Experience] --> AI[Intelligence]
  AI --> BE[Business Engines]
  BE --> EP[Event Platform]
  EP --> CORE[Core Services]
  CORE --> DB[(Supabase/PostgreSQL)]
```
