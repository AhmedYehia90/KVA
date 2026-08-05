import type { EventContractRegistry } from "./event-contract";
import type { EventBus } from "./event-bus";
import type { EventStore } from "./event-store";
import type { KvaEvent } from "./types";

export interface EventRuntimeOptions {
  contracts?: EventContractRegistry;
  requireRegisteredContracts?: boolean;
}

export class EventRuntime {
  constructor(
    private readonly store: EventStore,
    private readonly bus: EventBus,
    private readonly options: EventRuntimeOptions = {},
  ) {}

  async emit<TPayload>(event: KvaEvent<TPayload>): Promise<void> {
    if (this.options.requireRegisteredContracts) {
      if (!this.options.contracts) {
        throw new Error(
          "A contract registry is required when contract validation is enabled.",
        );
      }
      this.options.contracts.assert(event);
    }
    await this.store.append(event);
    await this.bus.publish(event);
  }
}
