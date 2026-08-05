import type { EventHandler, EventType, KvaEvent } from "./types";

export interface EventBus {
  subscribe<TEvent extends KvaEvent = KvaEvent>(
    eventType: EventType,
    handler: EventHandler<TEvent>,
  ): () => void;
  subscribeAll(handler: EventHandler): () => void;
  publish(event: KvaEvent): Promise<void>;
}

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<EventType, Set<EventHandler>>();
  private readonly globalHandlers = new Set<EventHandler>();

  subscribe<TEvent extends KvaEvent = KvaEvent>(
    eventType: EventType,
    handler: EventHandler<TEvent>,
  ): () => void {
    const handlers = this.handlers.get(eventType) ?? new Set<EventHandler>();
    handlers.add(handler as EventHandler);
    this.handlers.set(eventType, handlers);
    return () => handlers.delete(handler as EventHandler);
  }

  subscribeAll(handler: EventHandler): () => void {
    this.globalHandlers.add(handler);
    return () => this.globalHandlers.delete(handler);
  }

  async publish(event: KvaEvent): Promise<void> {
    const exact = [...(this.handlers.get(event.eventType) ?? [])];
    const global = [...this.globalHandlers];
    for (const handler of [...exact, ...global]) {
      await handler(event);
    }
  }
}
