export type EventType = `${string}.${string}`;
export type EventId = string;
export type EventVersion = number;
export type EventHandler<TEvent extends KvaEvent = KvaEvent> = (
  event: TEvent,
) => void | Promise<void>;

export interface EventMetadata {
  source?: string;
  schema?: string;
  privacy?: "public" | "internal" | "restricted";
  tags?: readonly string[];
  [key: string]: unknown;
}

export interface KvaEvent<TPayload = unknown> {
  id: EventId;
  eventType: EventType;
  eventVersion: EventVersion;
  organizationId?: string;
  aggregateType: string;
  aggregateId: string;
  actorId?: string;
  correlationId: string;
  causationId?: string;
  occurredAt: string;
  payload: TPayload;
  metadata: EventMetadata;
}

export interface CreateEventInput<TPayload> {
  eventType: EventType;
  eventVersion?: EventVersion;
  organizationId?: string;
  aggregateType: string;
  aggregateId: string;
  actorId?: string;
  correlationId?: string;
  causationId?: string;
  occurredAt?: Date | string;
  payload: TPayload;
  metadata?: EventMetadata;
}

export interface EventFilter {
  eventType?: EventType;
  organizationId?: string;
  aggregateType?: string;
  aggregateId?: string;
  correlationId?: string;
}
