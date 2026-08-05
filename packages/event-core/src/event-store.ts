import { DuplicateEventError } from "./errors";
import type { EventFilter, KvaEvent } from "./types";

export interface EventStore {
  append(event: KvaEvent): Promise<void>;
  has(eventId: string): Promise<boolean>;
  query(filter?: EventFilter): Promise<readonly KvaEvent[]>;
}

export class InMemoryEventStore implements EventStore {
  private readonly events: KvaEvent[] = [];
  private readonly eventIds = new Set<string>();

  async append(event: KvaEvent): Promise<void> {
    if (this.eventIds.has(event.id)) {
      throw new DuplicateEventError(`Event already exists: ${event.id}`);
    }
    this.events.push(Object.freeze({ ...event }));
    this.eventIds.add(event.id);
  }

  async has(eventId: string): Promise<boolean> {
    return this.eventIds.has(eventId);
  }

  async query(filter: EventFilter = {}): Promise<readonly KvaEvent[]> {
    return this.events.filter((event) => {
      if (filter.eventType && event.eventType !== filter.eventType) return false;
      if (
        filter.organizationId &&
        event.organizationId !== filter.organizationId
      ) return false;
      if (
        filter.aggregateType &&
        event.aggregateType !== filter.aggregateType
      ) return false;
      if (filter.aggregateId && event.aggregateId !== filter.aggregateId) {
        return false;
      }
      if (
        filter.correlationId &&
        event.correlationId !== filter.correlationId
      ) return false;
      return true;
    });
  }
}
