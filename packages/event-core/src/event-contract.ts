import { EventContractError } from "./errors";
import type { EventType, KvaEvent } from "./types";

export interface EventContract<TPayload = unknown> {
  eventType: EventType;
  version: number;
  producer: string;
  consumers: readonly string[];
  privacy: "public" | "internal" | "restricted";
  validatePayload: (payload: unknown) => payload is TPayload;
}

function contractKey(eventType: EventType, version: number): string {
  return `${eventType}@${version}`;
}

export class EventContractRegistry {
  private readonly contracts = new Map<string, EventContract>();

  register<TPayload>(contract: EventContract<TPayload>): void {
    const key = contractKey(contract.eventType, contract.version);
    if (this.contracts.has(key)) {
      throw new EventContractError(`Contract already registered: ${key}`);
    }
    this.contracts.set(key, contract as EventContract);
  }

  get(eventType: EventType, version: number): EventContract | undefined {
    return this.contracts.get(contractKey(eventType, version));
  }

  assert(event: KvaEvent): void {
    const key = contractKey(event.eventType, event.eventVersion);
    const contract = this.contracts.get(key);
    if (!contract) {
      throw new EventContractError(`No registered contract for ${key}`);
    }
    if (!contract.validatePayload(event.payload)) {
      throw new EventContractError(`Payload validation failed for ${key}`);
    }
  }
}
