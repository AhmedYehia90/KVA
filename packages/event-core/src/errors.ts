export class EventCoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidEventError extends EventCoreError {}
export class DuplicateEventError extends EventCoreError {}
export class EventContractError extends EventCoreError {}
