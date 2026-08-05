export type ProcessingStatus = "processing" | "processed" | "failed";

export interface ProcessingRecord {
  eventId: string;
  consumerName: string;
  status: ProcessingStatus;
  attempts: number;
  lastError?: string;
  updatedAt: string;
}

export interface ProcessingLog {
  get(eventId: string, consumerName: string): Promise<ProcessingRecord | undefined>;
  begin(eventId: string, consumerName: string): Promise<ProcessingRecord>;
  complete(eventId: string, consumerName: string): Promise<void>;
  fail(eventId: string, consumerName: string, error: unknown): Promise<void>;
}

function key(eventId: string, consumerName: string): string {
  return `${eventId}:${consumerName}`;
}

export class InMemoryProcessingLog implements ProcessingLog {
  private readonly records = new Map<string, ProcessingRecord>();

  async get(
    eventId: string,
    consumerName: string,
  ): Promise<ProcessingRecord | undefined> {
    return this.records.get(key(eventId, consumerName));
  }

  async begin(eventId: string, consumerName: string): Promise<ProcessingRecord> {
    const recordKey = key(eventId, consumerName);
    const previous = this.records.get(recordKey);
    const next: ProcessingRecord = {
      eventId,
      consumerName,
      status: "processing",
      attempts: (previous?.attempts ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(recordKey, next);
    return next;
  }

  async complete(eventId: string, consumerName: string): Promise<void> {
    const recordKey = key(eventId, consumerName);
    const previous = this.records.get(recordKey);
    this.records.set(recordKey, {
      eventId,
      consumerName,
      status: "processed",
      attempts: previous?.attempts ?? 1,
      updatedAt: new Date().toISOString(),
    });
  }

  async fail(
    eventId: string,
    consumerName: string,
    error: unknown,
  ): Promise<void> {
    const recordKey = key(eventId, consumerName);
    const previous = this.records.get(recordKey);
    this.records.set(recordKey, {
      eventId,
      consumerName,
      status: "failed",
      attempts: previous?.attempts ?? 1,
      lastError: error instanceof Error ? error.message : String(error),
      updatedAt: new Date().toISOString(),
    });
  }
}
