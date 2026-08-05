# Event Lifecycle

1. A domain service validates a command.
2. The service creates a versioned event envelope.
3. The runtime optionally validates the registered contract.
4. The event is appended to the store.
5. The bus publishes it to consumers.
6. Each consumer records an idempotent processing result.
7. Failures remain retryable and observable.
8. Permanent failures may later move to the dead-letter workflow.
