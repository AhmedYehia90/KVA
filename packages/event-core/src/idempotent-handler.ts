import type { ProcessingLog } from "./processing-log";
import type { EventHandler, KvaEvent } from "./types";

export function createIdempotentHandler<TEvent extends KvaEvent>(
  consumerName: string,
  processingLog: ProcessingLog,
  handler: EventHandler<TEvent>,
): EventHandler<TEvent> {
  if (!consumerName.trim()) {
    throw new Error("consumerName is required.");
  }

  return async (event: TEvent): Promise<void> => {
    const existing = await processingLog.get(event.id, consumerName);
    if (existing?.status === "processed") return;

    await processingLog.begin(event.id, consumerName);
    try {
      await handler(event);
      await processingLog.complete(event.id, consumerName);
    } catch (error) {
      await processingLog.fail(event.id, consumerName, error);
      throw error;
    }
  };
}
