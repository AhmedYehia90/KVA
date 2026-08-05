# Event Flow

```mermaid
flowchart LR
  A[Domain Transaction] --> B[Platform Event]
  B --> C[Dispatcher]
  C --> D[Consumer]
  D --> E[Processing Log]
  D --> F[Retry / Dead Letter]
```
