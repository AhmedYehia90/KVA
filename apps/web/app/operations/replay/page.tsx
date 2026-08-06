import type {Metadata} from "next";
import type {ReactNode} from "react";
import Link from "next/link";
import {addBlackBoxReplayNoteAction} from "./actions";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";
import {
  getBlackBoxReplayData,
  type BlackBoxReplayData,
  type BlackBoxReplayEvent,
  type BlackBoxIndexRow
} from "@/lib/operations/getBlackBoxReplayData";

export const metadata: Metadata = {
  title: "Black Box Replay | KVA OS",
  description: "Deterministic reconstruction of every flight from domain events."
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(new Date(value));
}

function phaseForEvent(eventType: string) {
  return {
    "flight.booked": "Booked",
    "aircraft.assigned": "Aircraft assigned",
    "dispatch.created": "Dispatch released",
    "flight.boarding_started": "Boarding",
    "flight.pushback_started": "Pushback",
    "flight.takeoff_recorded": "Takeoff",
    "flight.landing_recorded": "Landing",
    "flight.completed": "Completed",
    "pirep.draft_created": "PIREP draft",
    "pirep.created": "PIREP submitted",
    "replay.note_added": "Investigation note"
  }[eventType] ?? eventType;
}

function timeBetween(
  current: BlackBoxReplayEvent,
  previous: BlackBoxReplayEvent | undefined
) {
  if (!previous) return "Origin";

  const currentTime = new Date(current.occurredAt).getTime();
  const previousTime = new Date(previous.occurredAt).getTime();
  const seconds = Math.max(0, Math.round((currentTime - previousTime) / 1000));

  if (seconds < 60) return `+${seconds}s`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `+${minutes}m`;

  const hours = Math.round((minutes / 60) * 10) / 10;
  return `+${hours}h`;
}

export default async function BlackBoxReplayPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const user = await requireOperationsConsoleAdmin();
  const params = await searchParams;
  const requestedBookingId = first(params.bookingId);
  const message = first(params.message);
  const errorMessage = first(params.error);

  const data = await getBlackBoxReplayData(
    requestedBookingId || undefined,
    {
      id: user.id,
      email: user.email
    }
  );

  return (
    <main style={{minHeight:"100vh",background:"var(--bg)"}}>
      <section style={{
        padding:"72px 20px 112px",
        background:
          "radial-gradient(circle at 78% 24%,rgba(0,174,239,.24),transparent 30%),linear-gradient(145deg,#06152d,#0b2344 58%,#124d79)"
      }}>
        <div style={{maxWidth:1240,margin:"0 auto"}}>
          <Link
            href="/operations"
            style={{color:"var(--accent)",fontWeight:850}}
          >
            ← Operations Center
          </Link>

          <p className="eyebrow" style={{marginTop:34}}>
            KVA OS · Pillar 03
          </p>
          <h1 style={{
            margin:"12px 0 18px",
            fontSize:"clamp(3.4rem,8vw,6.3rem)",
            lineHeight:.92,
            letterSpacing:"-.06em"
          }}>
            Black Box Replay
          </h1>
          <p style={{
            maxWidth:820,
            margin:0,
            color:"var(--muted)",
            lineHeight:1.8
          }}>
            Reconstruct every flight from its immutable domain events, inspect
            evidence, validate projection integrity and export the complete
            operational record.
          </p>
        </div>
      </section>

      <section style={{padding:"0 20px 100px"}}>
        <div style={{
          maxWidth:1240,
          margin:"0 auto",
          display:"grid",
          gap:22,
          transform:"translateY(-42px)"
        }}>
          {message ? <Notice success>{message}</Notice> : null}
          {errorMessage ? <Notice>{errorMessage}</Notice> : null}

          <div style={{
            display:"grid",
            gridTemplateColumns:"minmax(280px,360px) minmax(0,1fr)",
            gap:22,
            alignItems:"start"
          }}>
            <FlightIndex
              flights={data.flights}
              selectedBookingId={data.selectedBookingId}
            />

            {data.replay ? (
              <ReplayPanel replay={data.replay} />
            ) : (
              <section style={panelStyle}>
                <div style={emptyStyle}>
                  No flight events are available for replay yet.
                </div>
              </section>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function FlightIndex({
  flights,
  selectedBookingId
}: {
  flights: BlackBoxIndexRow[];
  selectedBookingId: string | null;
}) {
  return (
    <aside style={{
      ...panelStyle,
      position:"sticky",
      top:18,
      maxHeight:"calc(100vh - 36px)",
      overflow:"auto"
    }}>
      <p className="eyebrow">Flight Archive</p>
      <h2 style={{margin:"8px 0 18px"}}>Available Replays</h2>

      <div style={{display:"grid",gap:10}}>
        {flights.length ? flights.map((flight) => {
          const selected = flight.booking_id === selectedBookingId;

          return (
            <Link
              key={flight.booking_id}
              href={`/operations/replay?bookingId=${flight.booking_id}`}
              style={{
                display:"block",
                padding:15,
                border:selected
                  ? "1px solid var(--accent)"
                  : "1px solid rgba(105,183,231,.13)",
                borderRadius:13,
                color:"inherit",
                textDecoration:"none",
                background:selected
                  ? "rgba(0,174,239,.12)"
                  : "rgba(4,16,32,.32)"
              }}
            >
              <div style={{
                display:"flex",
                justifyContent:"space-between",
                gap:12,
                alignItems:"center"
              }}>
                <strong>{flight.flight_number ?? "Unknown flight"}</strong>
                <span style={smallBadgeStyle}>{flight.status}</span>
              </div>

              <small style={{
                display:"block",
                marginTop:7,
                color:"var(--muted)"
              }}>
                {flight.event_count} events · {formatDate(flight.last_event_at)}
              </small>

              {flight.unhealthy_event_count > 0 ? (
                <small style={{
                  display:"block",
                  marginTop:7,
                  color:"#ffb1b1"
                }}>
                  {flight.unhealthy_event_count} unhealthy events
                </small>
              ) : null}
            </Link>
          );
        }) : (
          <div style={emptyStyle}>No replayable flights.</div>
        )}
      </div>
    </aside>
  );
}

function ReplayPanel({replay}: {replay: BlackBoxReplayData}) {
  const integrity = replay.integrity;
  const projection = replay.projection;

  return (
    <div style={{display:"grid",gap:22}}>
      <section style={panelStyle}>
        <div style={{
          display:"flex",
          justifyContent:"space-between",
          gap:18,
          alignItems:"flex-start",
          flexWrap:"wrap"
        }}>
          <div>
            <p className="eyebrow">Selected Flight</p>
            <h2 style={{margin:"8px 0 8px",fontSize:"2rem"}}>
              {projection.flightNumber ?? replay.bookingId}
            </h2>
            <p style={{margin:0,color:"var(--muted)"}}>
              Booking {replay.bookingId}
            </p>
          </div>

          <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
            <span style={{
              ...smallBadgeStyle,
              color:integrity.healthy ? "#98efbf" : "#ffb1b1"
            }}>
              {integrity.healthy ? "Integrity healthy" : "Integrity warning"}
            </span>

            <Link
              className="button"
              href={`/operations/replay/${replay.bookingId}/export`}
            >
              Export JSON
            </Link>
          </div>
        </div>

        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",
          gap:12,
          marginTop:22
        }}>
          <Stat label="Events" value={String(integrity.eventCount)} />
          <Stat label="Replay Status" value={integrity.replayedStatus} />
          <Stat label="Projection" value={integrity.projectionStatus} />
          <Stat
            label="Processing Issues"
            value={String(integrity.unhealthyProcessingCount)}
          />
          <Stat
            label="Broken Causation"
            value={String(integrity.unresolvedCausationLinks)}
          />
          <Stat
            label="Correlations"
            value={String(integrity.correlationCount)}
          />
        </div>
      </section>

      <section style={panelStyle}>
        <p className="eyebrow">Integrity Report</p>
        <h2>Source-to-Projection Checks</h2>

        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
          gap:12,
          marginTop:18
        }}>
          <IntegrityCheck
            label="Origin event"
            passed={integrity.hasOriginEvent}
            detail="flight.booked exists"
          />
          <IntegrityCheck
            label="Projection last event"
            passed={integrity.projectionLastEventPresent}
            detail={projection.lastEventType}
          />
          <IntegrityCheck
            label="Status agreement"
            passed={integrity.statusMatchesProjection}
            detail={`${integrity.replayedStatus} = ${integrity.projectionStatus}`}
          />
          <IntegrityCheck
            label="Event processing"
            passed={integrity.unhealthyProcessingCount === 0}
            detail={`${integrity.unhealthyProcessingCount} unhealthy`}
          />
          <IntegrityCheck
            label="Single correlation"
            passed={integrity.singleCorrelation}
            detail={`${integrity.correlationCount} correlation IDs`}
          />
          <IntegrityCheck
            label="Causation coverage"
            passed={integrity.missingCausationLinks === 0}
            detail={`${integrity.missingCausationLinks} missing`}
          />
          <IntegrityCheck
            label="Sequential causation"
            passed={
              integrity.unexpectedCausationLinks === 0 &&
              integrity.unresolvedCausationLinks === 0
            }
            detail={`${integrity.unexpectedCausationLinks} unexpected · ${integrity.unresolvedCausationLinks} unresolved`}
          />
        </div>
      </section>

      <section style={panelStyle}>
        <p className="eyebrow">Deterministic Timeline</p>
        <h2>Flight Event Replay</h2>

        <div style={{display:"grid",gap:14,marginTop:20}}>
          {replay.events.map((event, index) => (
            <ReplayEventCard
              key={event.id}
              event={event}
              index={index}
              previous={replay.events[index - 1]}
            />
          ))}
        </div>
      </section>

      <section style={panelStyle}>
        <p className="eyebrow">Investigation</p>
        <h2>Replay Notes</h2>

        <form
          action={addBlackBoxReplayNoteAction}
          style={{
            display:"grid",
            gridTemplateColumns:"1fr auto",
            gap:10,
            marginTop:18
          }}
        >
          <input
            type="hidden"
            name="bookingId"
            value={replay.bookingId}
          />
          <textarea
            name="note"
            rows={3}
            maxLength={2000}
            required
            placeholder="Add an investigation note..."
            style={textareaStyle}
          />
          <button className="button" type="submit">
            Add note
          </button>
        </form>

        <div style={{display:"grid",gap:12,marginTop:18}}>
          {replay.notes.length ? replay.notes.map((note) => (
            <article key={note.id} style={miniCardStyle}>
              <div style={{
                display:"flex",
                justifyContent:"space-between",
                gap:14,
                flexWrap:"wrap"
              }}>
                <strong>{note.authorEmail}</strong>
                <small style={{color:"var(--muted)"}}>
                  {formatDate(note.createdAt)}
                </small>
              </div>
              <p style={{margin:"10px 0 0",lineHeight:1.7}}>
                {note.note}
              </p>
            </article>
          )) : (
            <div style={emptyStyle}>No investigation notes yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function ReplayEventCard({
  event,
  index,
  previous
}: {
  event: BlackBoxReplayEvent;
  index: number;
  previous: BlackBoxReplayEvent | undefined;
}) {
  const processing = event.processing;

  return (
    <article style={{
      display:"grid",
      gridTemplateColumns:"56px minmax(0,1fr)",
      gap:16,
      padding:18,
      border:"1px solid rgba(105,183,231,.14)",
      borderRadius:16,
      background:"rgba(4,16,32,.32)"
    }}>
      <div style={{
        width:44,
        height:44,
        display:"grid",
        placeItems:"center",
        borderRadius:"50%",
        color:"#031524",
        background:"var(--accent)",
        fontWeight:950
      }}>
        {index + 1}
      </div>

      <div>
        <div style={{
          display:"flex",
          justifyContent:"space-between",
          gap:16,
          alignItems:"flex-start",
          flexWrap:"wrap"
        }}>
          <div>
            <strong style={{display:"block",fontSize:"1.15rem"}}>
              {phaseForEvent(event.eventType)}
            </strong>
            <small style={{
              display:"block",
              marginTop:6,
              color:"var(--muted)"
            }}>
              #{event.streamPosition} · {event.eventType} · {event.id}
            </small>
          </div>

          <div style={{textAlign:"right"}}>
            <strong>{formatDate(event.occurredAt)}</strong>
            <small style={{
              display:"block",
              marginTop:5,
              color:"var(--accent)"
            }}>
              {timeBetween(event, previous)}
            </small>
          </div>
        </div>

        <div style={{
          display:"flex",
          gap:8,
          flexWrap:"wrap",
          marginTop:14
        }}>
          <span style={smallBadgeStyle}>
            v{event.eventVersion}
          </span>
          <span style={smallBadgeStyle}>
            {event.aggregateType}
          </span>
          <span style={{
            ...smallBadgeStyle,
            color:
              processing?.status === "PROCESSED"
                ? "#98efbf"
                : processing
                  ? "#ffb1b1"
                  : "var(--muted)"
          }}>
            {processing?.status ?? "No projector action"}
          </span>
        </div>

        <details style={{marginTop:15}}>
          <summary style={{
            color:"var(--accent)",
            fontWeight:850,
            cursor:"pointer"
          }}>
            Inspect event evidence
          </summary>

          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",
            gap:12,
            marginTop:12
          }}>
            <Evidence label="Correlation" value={event.correlationId} />
            <Evidence
              label="Causation"
              value={event.causationId ?? "Origin / independent"}
            />
            <Evidence label="Actor" value={event.actorId ?? "System"} />
            <Evidence
              label="Attempts"
              value={String(processing?.attempts ?? 0)}
            />
          </div>

          <pre style={preStyle}>
            {JSON.stringify(
              {
                payload: event.payload,
                metadata: event.metadata,
                processing
              },
              null,
              2
            )}
          </pre>
        </details>
      </div>
    </article>
  );
}

function Evidence({label, value}: {label:string; value:string}) {
  return (
    <article style={miniCardStyle}>
      <small style={{color:"var(--muted)",fontWeight:850}}>
        {label.toUpperCase()}
      </small>
      <strong style={{
        display:"block",
        marginTop:7,
        overflowWrap:"anywhere",
        fontSize:".82rem"
      }}>
        {value}
      </strong>
    </article>
  );
}

function IntegrityCheck({
  label,
  passed,
  detail
}: {
  label:string;
  passed:boolean;
  detail:string;
}) {
  return (
    <article style={miniCardStyle}>
      <div style={{
        display:"flex",
        justifyContent:"space-between",
        gap:12
      }}>
        <strong>{label}</strong>
        <span style={{color:passed ? "#98efbf" : "#ffb1b1"}}>
          {passed ? "PASS" : "WARN"}
        </span>
      </div>
      <small style={{
        display:"block",
        marginTop:8,
        color:"var(--muted)"
      }}>
        {detail}
      </small>
    </article>
  );
}

function Notice({
  children,
  success = false
}: {
  children: ReactNode;
  success?: boolean;
}) {
  return (
    <div style={{
      padding:15,
      borderRadius:13,
      color:success ? "#98efbf" : "#ffb1b1",
      background:success
        ? "rgba(57,220,138,.1)"
        : "rgba(255,95,95,.1)"
    }}>
      {children}
    </div>
  );
}

function Stat({label, value}: {label:string; value:string}) {
  return (
    <article style={miniCardStyle}>
      <small style={{color:"var(--muted)",fontWeight:850}}>
        {label.toUpperCase()}
      </small>
      <strong style={{
        display:"block",
        marginTop:9,
        fontSize:"1.45rem",
        textTransform:"capitalize"
      }}>
        {value}
      </strong>
    </article>
  );
}

const panelStyle = {
  padding:22,
  border:"1px solid var(--border)",
  borderRadius:20,
  background:"var(--surface)"
} as const;

const miniCardStyle = {
  padding:16,
  border:"1px solid rgba(105,183,231,.13)",
  borderRadius:13,
  background:"rgba(4,16,32,.32)"
} as const;

const emptyStyle = {
  padding:26,
  border:"1px dashed var(--border)",
  borderRadius:13,
  color:"var(--muted)",
  textAlign:"center"
} as const;

const smallBadgeStyle = {
  display:"inline-flex",
  alignItems:"center",
  padding:"6px 9px",
  borderRadius:999,
  color:"var(--text)",
  background:"rgba(255,255,255,.075)",
  fontSize:".7rem",
  fontWeight:850,
  textTransform:"uppercase"
} as const;

const textareaStyle = {
  width:"100%",
  minHeight:86,
  padding:13,
  border:"1px solid var(--border)",
  borderRadius:12,
  color:"inherit",
  background:"rgba(4,16,32,.44)",
  resize:"vertical"
} as const;

const preStyle = {
  maxHeight:420,
  overflow:"auto",
  margin:"12px 0 0",
  padding:14,
  borderRadius:10,
  color:"#b9d7ef",
  background:"#03101f",
  fontSize:".75rem",
  lineHeight:1.55,
  whiteSpace:"pre-wrap"
} as const;
