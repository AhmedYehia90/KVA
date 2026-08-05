import { InvalidEventError } from "./errors";
import type { CreateEventInput, KvaEvent } from "./types";

const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$/;

function createId(): string {
  return globalThis.crypto.randomUUID();
}

function normalizeOccurredAt(value?: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new InvalidEventError("occurredAt must be a valid ISO date.");
    }
    return parsed.toISOString();
  }
  return new Date().toISOString();
}

export function createEvent<TPayload>(
  input: CreateEventInput<TPayload>,
): KvaEvent<TPayload> {
  if (!EVENT_TYPE_PATTERN.test(input.eventType)) {
    throw new InvalidEventError(
      "eventType must follow the domain.action convention.",
    );
  }
  if (!input.aggregateType.trim() || !input.aggregateId.trim()) {
    throw new InvalidEventError(
      "aggregateType and aggregateId are required.",
    );
  }
  const version = input.eventVersion ?? 1;
  if (!Number.isInteger(version) || version < 1) {
    throw new InvalidEventError("eventVersion must be a positive integer.");
  }

  const id = createId();
  return {
    id,
    eventType: input.eventType,
    eventVersion: version,
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    ...(input.actorId ? { actorId: input.actorId } : {}),
    correlationId: input.correlationId ?? id,
    ...(input.causationId ? { causationId: input.causationId } : {}),
    occurredAt: normalizeOccurredAt(input.occurredAt),
    payload: input.payload,
    metadata: { ...(input.metadata ?? {}) },
  };
}
