import type {Metadata} from "next";
import Link from "next/link";
import {
  rebuildProjectionAction,
  retryFailedEventsAction,
  retrySingleEventAction
} from "./actions";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";
import {getEventConsoleData} from "@/lib/operations/getEventConsoleData";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Event Operations Console | KVA OS",
  description: "Internal KVA event stream and projector operations console."
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function valueOf(
  value: string | string[] | undefined
): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date(value));
}

function shorten(value: string | null | undefined): string {
  if (!value) return "—";
  return value.length > 16
    ? `${value.slice(0, 8)}…${value.slice(-6)}`
    : value;
}

function json(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function statusClass(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized === "processed" || normalized === "succeeded") {
    return styles.success;
  }

  if (normalized === "failed" || normalized === "rejected") {
    return styles.failure;
  }

  return styles.pending;
}

export default async function EventOperationsConsolePage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const user = await requireOperationsConsoleAdmin();
  const params = await searchParams;
  const eventType = valueOf(params.type).trim();
  const status = valueOf(params.status).trim() || "ALL";
  const message = valueOf(params.message);
  const error = valueOf(params.error);

  const data = await getEventConsoleData({
    eventType: eventType || undefined,
    status
  });

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroTop}>
            <Link href="/operations" className={styles.backLink}>
              ← Operations Center
            </Link>
            <span className={styles.adminBadge}>
              {user.email ?? "Operations administrator"}
            </span>
          </div>

          <p className="eyebrow">KVA Event Platform</p>
          <h1>Event Operations Console</h1>
          <p className={styles.lead}>
            Inspect domain events, projector processing, read-model state,
            retries and audited maintenance actions.
          </p>
        </div>
      </section>

      <section className={styles.content}>
        <div className="container">
          {message ? (
            <div className={`${styles.alert} ${styles.alertSuccess}`}>
              {message}
            </div>
          ) : null}

          {error ? (
            <div className={`${styles.alert} ${styles.alertError}`}>
              {error}
            </div>
          ) : null}

          <div className={styles.stats}>
            <Stat label="Domain events" value={data.stats.totalEvents} />
            <Stat label="Processed" value={data.stats.processed} />
            <Stat label="Failed" value={data.stats.failed} tone="danger" />
            <Stat label="Pending" value={data.stats.pending} tone="warning" />
            <Stat label="Flight projections" value={data.stats.projections} />
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <p className="eyebrow">Query</p>
                <h2>Event stream</h2>
              </div>

              <form className={styles.filters}>
                <input
                  name="type"
                  defaultValue={eventType}
                  placeholder="flight.completed"
                  aria-label="Event type"
                />
                <select
                  name="status"
                  defaultValue={status}
                  aria-label="Processing status"
                >
                  <option value="ALL">All processing states</option>
                  <option value="PROCESSED">Processed</option>
                  <option value="FAILED">Failed</option>
                  <option value="PENDING">Pending</option>
                  <option value="PROCESSING">Processing</option>
                </select>
                <button type="submit">Apply filters</button>
                <Link href="/operations/events">Reset</Link>
              </form>
            </div>

            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Aggregate</th>
                    <th>Occurred</th>
                    <th>Correlation</th>
                    <th>Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.length ? (
                    data.events.map((event) => (
                      <tr key={event.id}>
                        <td>
                          <strong>{event.event_type}</strong>
                          <small>
                            v{event.event_version} · {shorten(event.id)}
                          </small>
                        </td>
                        <td>
                          <strong>{event.aggregate_type}</strong>
                          <small>{shorten(event.aggregate_id)}</small>
                        </td>
                        <td>{formatDate(event.occurred_at)}</td>
                        <td>
                          <small>{shorten(event.correlation_id)}</small>
                        </td>
                        <td>
                          <details>
                            <summary>Inspect</summary>
                            <pre>{json(event.payload)}</pre>
                          </details>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className={styles.empty}>
                        No events match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className={styles.twoColumns}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <p className="eyebrow">Consumer</p>
                  <h2>Projector processing</h2>
                </div>
              </div>

              <div className={styles.processingList}>
                {data.processing.length ? (
                  data.processing.map((record) => (
                    <article className={styles.processingCard} key={record.id}>
                      <div>
                        <span
                          className={`${styles.status} ${statusClass(
                            record.status
                          )}`}
                        >
                          {record.status}
                        </span>
                        <strong>
                          {record.event?.event_type ?? "Unknown event"}
                        </strong>
                        <small>
                          {shorten(record.event_id)} · attempt {record.attempts}
                        </small>
                      </div>

                      <div className={styles.processingMeta}>
                        <span>{formatDate(record.updated_at)}</span>
                        {record.last_error ? (
                          <p>{record.last_error}</p>
                        ) : null}
                      </div>

                      {record.status === "FAILED" ? (
                        <form action={retrySingleEventAction}>
                          <input
                            type="hidden"
                            name="eventId"
                            value={record.event_id}
                          />
                          <button type="submit">Retry event</button>
                        </form>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className={styles.empty}>
                    No processing records match the current filter.
                  </p>
                )}
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <p className="eyebrow">Read model</p>
                  <h2>Flight projections</h2>
                </div>
              </div>

              <div className={styles.projectionList}>
                {data.projections.length ? (
                  data.projections.map((projection) => (
                    <article
                      className={styles.projectionCard}
                      key={projection.booking_id}
                    >
                      <div>
                        <strong>{projection.flight_number ?? "Flight"}</strong>
                        <small>{shorten(projection.booking_id)}</small>
                      </div>
                      <span
                        className={`${styles.status} ${statusClass(
                          projection.status === "completed"
                            ? "processed"
                            : "pending"
                        )}`}
                      >
                        {projection.status}
                      </span>
                      <dl>
                        <div>
                          <dt>Last event</dt>
                          <dd>{projection.last_event_type}</dd>
                        </div>
                        <div>
                          <dt>Version</dt>
                          <dd>{projection.projection_version}</dd>
                        </div>
                        <div>
                          <dt>Updated</dt>
                          <dd>{formatDate(projection.last_event_at)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))
                ) : (
                  <p className={styles.empty}>
                    No flight projections are available.
                  </p>
                )}
              </div>
            </section>
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <p className="eyebrow">Controlled actions</p>
                <h2>Projector maintenance</h2>
              </div>
            </div>

            <div className={styles.actionsGrid}>
              <form
                action={retryFailedEventsAction}
                className={styles.actionCard}
              >
                <h3>Retry failed or pending events</h3>
                <p>
                  Reprocesses eligible events in chronological order without
                  touching successfully processed records.
                </p>
                <label>
                  Maximum events
                  <input
                    name="limit"
                    type="number"
                    min="1"
                    max="500"
                    defaultValue="100"
                  />
                </label>
                <button type="submit">Run retry</button>
              </form>

              <form
                action={rebuildProjectionAction}
                className={`${styles.actionCard} ${styles.dangerCard}`}
              >
                <h3>Rebuild the read model</h3>
                <p>
                  Clears the disposable operations projection and reconstructs
                  it from the durable event stream.
                </p>
                <label>
                  Type REBUILD to confirm
                  <input
                    name="confirmation"
                    autoComplete="off"
                    placeholder="REBUILD"
                  />
                </label>
                <button type="submit">Rebuild projection</button>
              </form>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <p className="eyebrow">Accountability</p>
                <h2>Maintenance audit</h2>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Status</th>
                    <th>Time</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.audit.length ? (
                    data.audit.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <strong>{entry.action}</strong>
                        </td>
                        <td>{entry.actor_email}</td>
                        <td>
                          <span
                            className={`${styles.status} ${statusClass(
                              entry.status
                            )}`}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td>{formatDate(entry.created_at)}</td>
                        <td>
                          <details>
                            <summary>Inspect</summary>
                            <pre>
                              {json({
                                input: entry.input,
                                result: entry.result,
                                error: entry.error
                              })}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className={styles.empty}>
                        No maintenance actions have been recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone?: "danger" | "warning";
}) {
  return (
    <article
      className={`${styles.stat} ${
        tone === "danger"
          ? styles.statDanger
          : tone === "warning"
            ? styles.statWarning
            : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value.toLocaleString("en-US")}</strong>
    </article>
  );
}
