CREATE TYPE "EventProcessingStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
  'DEAD_LETTER'
);

CREATE TABLE "platform_events" (
  "id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "event_version" INTEGER NOT NULL DEFAULT 1,
  "organization_id" TEXT,
  "aggregate_type" TEXT NOT NULL,
  "aggregate_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "correlation_id" UUID NOT NULL,
  "causation_id" UUID,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "payload" JSONB NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_processing_log" (
  "id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "consumer_name" TEXT NOT NULL,
  "status" "EventProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "processed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "event_processing_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_events_event_type_occurred_at_idx"
  ON "platform_events"("event_type", "occurred_at");
CREATE INDEX "platform_events_organization_id_occurred_at_idx"
  ON "platform_events"("organization_id", "occurred_at");
CREATE INDEX "platform_events_aggregate_type_aggregate_id_occurred_at_idx"
  ON "platform_events"("aggregate_type", "aggregate_id", "occurred_at");
CREATE INDEX "platform_events_correlation_id_idx"
  ON "platform_events"("correlation_id");
CREATE UNIQUE INDEX "event_processing_log_event_id_consumer_name_key"
  ON "event_processing_log"("event_id", "consumer_name");
CREATE INDEX "event_processing_log_status_updated_at_idx"
  ON "event_processing_log"("status", "updated_at");

ALTER TABLE "event_processing_log"
  ADD CONSTRAINT "event_processing_log_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "platform_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
