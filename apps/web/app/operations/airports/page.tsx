import type {Metadata} from "next";
import Link from "next/link";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {
  createAirportNoticeAction,
  setAirportNoticeLifecycleAction,
  updateAirportNoticeAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Airport World Console | KVA OS",
  description: "Operations administration for Living Airports.",
};

export const dynamic = "force-dynamic";

const ORG = "kalabsha-airlines";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Airport = {
  id: string;
  icao_code: string;
  iata_code: string | null;
  name: string;
  city: string | null;
  country: string | null;
};

type Notice = {
  id: string;
  airport_id: string;
  publisher_organization_id: string;
  category: string;
  severity: string;
  title: string;
  message: string;
  lifecycle_status: string;
  starts_at: string;
  ends_at: string | null;
  source_label: string | null;
  source_reference: string | null;
  created_at: string;
  updated_at: string;
  airport?: Airport | Airport[] | null;
};

type Audit = {
  id: string;
  airport_id: string | null;
  notice_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

const categories = [
  ["operations", "Operations"],
  ["event", "Event"],
  ["community", "Community"],
  ["network", "Network"],
  ["advisory", "Advisory"],
] as const;

const severities = [
  ["info", "Info"],
  ["watch", "Watch"],
  ["important", "Important"],
] as const;

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function q(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function localInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AirportWorldConsole({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOperationsConsoleAdmin();
  const query = await searchParams;
  const admin = createAdminClient();

  const [airportR, noticeR, auditR] = await Promise.all([
    admin
      .from("airports")
      .select("id,icao_code,iata_code,name,city,country")
      .eq("active", true)
      .order("icao_code"),
    admin
      .from("airport_world_notices")
      .select(`
        *,
        airport:airports(
          id,
          icao_code,
          iata_code,
          name,
          city,
          country
        )
      `)
      .eq("publisher_organization_id", ORG)
      .order("created_at", {ascending: false}),
    admin
      .from("airport_world_admin_audit")
      .select("id,airport_id,notice_id,action,details,created_at")
      .eq("organization_id", ORG)
      .order("created_at", {ascending: false})
      .limit(40),
  ]);

  const error = airportR.error ?? noticeR.error ?? auditR.error;
  if (error) {
    throw new Error(`Unable to load Airport World Console: ${error.message}`);
  }

  const airports = (airportR.data ?? []) as Airport[];
  const notices = (noticeR.data ?? []) as unknown as Notice[];
  const audits = (auditR.data ?? []) as Audit[];

  const published = notices.filter(
    (notice) => notice.lifecycle_status === "published",
  ).length;
  const drafts = notices.filter(
    (notice) => notice.lifecycle_status === "draft",
  ).length;
  const closed = notices.filter(
    (notice) => notice.lifecycle_status === "closed",
  ).length;

  return (
    <main style={{minHeight: "100vh", background: "var(--bg)"}}>
      <section style={hero}>
        <div style={{maxWidth: 1180, margin: "0 auto"}}>
          <div style={{display: "flex", gap: 14, flexWrap: "wrap"}}>
            <Link href="/operations" style={topLink}>
              ← Operations Center
            </Link>
            <Link href="/airports" style={topLink}>
              Open Living Airports →
            </Link>
          </div>

          <p className="eyebrow" style={{marginTop: 30}}>
            KVA OS · PILLAR 10 · OPERATIONS CONTEXT
          </p>
          <h1 style={heroTitle}>Airport World Console</h1>
          <p style={heroText}>
            Publish KVA OS airport context without pretending to be real-world
            NOTAM, weather or ATC authority. Operational flight truth continues
            to come from the KVA OS flight/event systems.
          </p>
        </div>
      </section>

      <section style={{padding: "0 20px 100px"}}>
        <div style={body}>
          {q(query.message) ? <div style={success}>{q(query.message)}</div> : null}
          {q(query.error) ? <div style={errorBox}>{q(query.error)}</div> : null}

          <section style={stats}>
            <Stat label="CONNECTED AIRPORTS" value={String(airports.length)} />
            <Stat label="DRAFT NOTICES" value={String(drafts)} />
            <Stat label="PUBLISHED" value={String(published)} />
            <Stat label="CLOSED" value={String(closed)} />
          </section>

          <section style={panel}>
            <p className="eyebrow">NEW AIRPORT CONTEXT</p>
            <h2 style={sectionTitle}>Create a KVA OS airport notice</h2>
            <p style={muted}>
              Use this for platform/airline world context such as an event
              focus, community activity, network spotlight or internal
              operational advisory. Do not copy or fabricate real-world NOTAM
              or weather unless a verified source is explicitly integrated.
            </p>

            <form action={createAirportNoticeAction} style={formGrid}>
              <label style={field}>
                <span style={fieldLabel}>Airport</span>
                <select name="airportId" required style={input}>
                  {airports.map((airport) => (
                    <option key={airport.id} value={airport.id}>
                      {airport.icao_code} · {airport.name}
                    </option>
                  ))}
                </select>
              </label>

              <Select name="category" label="Category" options={categories} />
              <Select name="severity" label="Severity" options={severities} />
              <Field name="title" label="Title" required />
              <Field
                name="startsAt"
                label="Starts At"
                type="datetime-local"
              />
              <TextArea name="message" label="Message" required />
              <Field name="endsAt" label="Ends At" type="datetime-local" />
              <Field
                name="sourceLabel"
                label="Source Label"
                placeholder="KVA OS Operations / Event Console"
              />
              <Field
                name="sourceReference"
                label="Source Reference"
                placeholder="Internal reference or verified source ID"
              />

              <div style={{gridColumn: "1 / -1"}}>
                <button className="button" type="submit">
                  Create Draft
                </button>
              </div>
            </form>
          </section>

          <section style={panel}>
            <div style={sectionHead}>
              <div>
                <p className="eyebrow">AIRPORT NOTICE LIBRARY</p>
                <h2 style={sectionTitle}>Draft, publish and close world context</h2>
              </div>
              <span style={authorityBadge}>OPERATIONS AUTHORITY</span>
            </div>

            <div style={{display: "grid", gap: 16, marginTop: 22}}>
              {notices.length ? (
                notices.map((notice) => {
                  const airport = first(notice.airport);
                  return (
                    <article key={notice.id} style={noticeCard}>
                      <div style={sectionHead}>
                        <div>
                          <span style={statusBadge}>
                            {notice.lifecycle_status.toUpperCase()}
                          </span>
                          <h3 style={{margin: "9px 0 5px"}}>
                            {airport?.icao_code ?? "Airport"} · {notice.title}
                          </h3>
                          <small style={{color: "var(--muted)"}}>
                            {notice.category} · {notice.severity} ·{" "}
                            {dateTime(notice.starts_at)}
                          </small>
                        </div>

                        <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                          {notice.lifecycle_status !== "published" ? (
                            <Lifecycle
                              notice={notice}
                              airport={airport}
                              status="published"
                              label="Publish"
                            />
                          ) : (
                            <Lifecycle
                              notice={notice}
                              airport={airport}
                              status="draft"
                              label="Return to Draft"
                            />
                          )}
                          {notice.lifecycle_status !== "closed" ? (
                            <Lifecycle
                              notice={notice}
                              airport={airport}
                              status="closed"
                              label="Close"
                            />
                          ) : null}
                        </div>
                      </div>

                      <form
                        action={updateAirportNoticeAction}
                        style={{...formGrid, marginTop: 18}}
                      >
                        <input type="hidden" name="noticeId" value={notice.id} />
                        <Select
                          name="category"
                          label="Category"
                          options={categories}
                          defaultValue={notice.category}
                        />
                        <Select
                          name="severity"
                          label="Severity"
                          options={severities}
                          defaultValue={notice.severity}
                        />
                        <Field
                          name="title"
                          label="Title"
                          defaultValue={notice.title}
                          required
                        />
                        <Field
                          name="startsAt"
                          label="Starts At"
                          type="datetime-local"
                          defaultValue={localInput(notice.starts_at)}
                        />
                        <TextArea
                          name="message"
                          label="Message"
                          defaultValue={notice.message}
                          required
                        />
                        <Field
                          name="endsAt"
                          label="Ends At"
                          type="datetime-local"
                          defaultValue={localInput(notice.ends_at)}
                        />
                        <Field
                          name="sourceLabel"
                          label="Source Label"
                          defaultValue={notice.source_label ?? ""}
                        />
                        <Field
                          name="sourceReference"
                          label="Source Reference"
                          defaultValue={notice.source_reference ?? ""}
                        />

                        <div style={{gridColumn: "1 / -1"}}>
                          <button className="button outline" type="submit">
                            Save Changes
                          </button>
                        </div>
                      </form>
                    </article>
                  );
                })
              ) : (
                <Empty text="No airport-world notices exist yet." />
              )}
            </div>
          </section>

          <section style={panel}>
            <p className="eyebrow">WORLD ADMIN AUDIT</p>
            <h2 style={sectionTitle}>Administrative history</h2>

            <div style={{display: "grid", gap: 10, marginTop: 18}}>
              {audits.length ? (
                audits.map((audit) => (
                  <div key={audit.id} style={auditRow}>
                    <strong style={{textTransform: "capitalize"}}>
                      {audit.action.replaceAll("_", " ")}
                    </strong>
                    <time style={{color: "var(--muted)", fontSize: ".8rem"}}>
                      {dateTime(audit.created_at)}
                    </time>
                  </div>
                ))
              ) : (
                <Empty text="No airport-world administrative actions yet." />
              )}
            </div>
          </section>

          <section style={integrity}>
            <strong>Context never becomes hidden operational authority.</strong>
            <span style={{color: "var(--muted)"}}>
              A notice cannot change a booking, route, aircraft location, fleet
              registration, PIREP, event credit, Career XP or KVC.
            </span>
          </section>
        </div>
      </section>
    </main>
  );
}

function Lifecycle({
  notice,
  airport,
  status,
  label,
}: {
  notice: Notice;
  airport: Airport | null;
  status: string;
  label: string;
}) {
  return (
    <form action={setAirportNoticeLifecycleAction}>
      <input type="hidden" name="noticeId" value={notice.id} />
      <input type="hidden" name="status" value={status} />
      <button className="button outline" type="submit">
        {label}
      </button>
    </form>
  );
}

function Stat({label, value}: {label: string; value: string}) {
  return (
    <div style={statCard}>
      <small style={fieldLabel}>{label}</small>
      <strong style={{display: "block", marginTop: 8, fontSize: "1.6rem"}}>
        {value}
      </strong>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  defaultValue,
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label style={field}>
      <span style={fieldLabel}>{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        style={input}
      />
    </label>
  );
}

function TextArea({
  name,
  label,
  defaultValue,
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label style={{...field, gridColumn: "span 2"}}>
      <span style={fieldLabel}>{label}</span>
      <textarea
        name={name}
        rows={4}
        defaultValue={defaultValue}
        required={required}
        style={{...input, resize: "vertical", lineHeight: 1.5}}
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: readonly (readonly [string, string])[];
  defaultValue?: string;
}) {
  return (
    <label style={field}>
      <span style={fieldLabel}>{label}</span>
      <select name={name} defaultValue={defaultValue} style={input}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Empty({text}: {text: string}) {
  return <div style={empty}>{text}</div>;
}

const hero = {
  padding: "72px 20px 112px",
  background:
    "radial-gradient(circle at 80% 20%,rgba(0,174,239,.25),transparent 30%),linear-gradient(145deg,#06152d,#0b2344 58%,#124d79)",
} as const;

const body = {
  maxWidth: 1180,
  margin: "0 auto",
  display: "grid",
  gap: 22,
  transform: "translateY(-44px)",
} as const;

const topLink = {
  color: "var(--accent)",
  fontWeight: 850,
} as const;

const heroTitle = {
  fontSize: "clamp(3.2rem,7vw,5.8rem)",
  margin: "10px 0 14px",
  letterSpacing: "-.055em",
} as const;

const heroText = {
  maxWidth: 850,
  margin: 0,
  color: "var(--muted)",
  lineHeight: 1.8,
} as const;

const stats = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 12,
} as const;

const statCard = {
  padding: 20,
  border: "1px solid var(--border)",
  borderRadius: 18,
  background: "var(--surface)",
} as const;

const panel = {
  padding: 26,
  border: "1px solid var(--border)",
  borderRadius: 22,
  background: "var(--surface)",
} as const;

const sectionTitle = {
  margin: "8px 0 0",
  fontSize: "2rem",
} as const;

const sectionHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
} as const;

const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 14,
  marginTop: 20,
} as const;

const field = {
  display: "grid",
  gap: 7,
} as const;

const fieldLabel = {
  fontSize: ".72rem",
  fontWeight: 850,
  letterSpacing: ".08em",
  textTransform: "uppercase",
} as const;

const input = {
  width: "100%",
  minHeight: 42,
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: 11,
  background: "rgba(4,16,32,.52)",
  color: "inherit",
} as const;

const noticeCard = {
  padding: 20,
  border: "1px solid rgba(105,183,231,.17)",
  borderRadius: 18,
  background: "rgba(4,16,32,.22)",
} as const;

const statusBadge = {
  padding: "5px 8px",
  border: "1px solid rgba(121,217,255,.20)",
  borderRadius: 999,
  color: "#79d9ff",
  fontSize: ".67rem",
  fontWeight: 900,
} as const;

const authorityBadge = {
  padding: "7px 10px",
  border: "1px solid rgba(121,217,255,.23)",
  borderRadius: 999,
  color: "#79d9ff",
  fontSize: ".7rem",
  fontWeight: 850,
  letterSpacing: ".08em",
} as const;

const auditRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
  padding: 14,
  border: "1px solid rgba(105,183,231,.13)",
  borderRadius: 13,
  background: "rgba(4,16,32,.18)",
} as const;

const success = {
  padding: 14,
  border: "1px solid rgba(57,220,138,.25)",
  borderRadius: 14,
  background: "rgba(57,220,138,.08)",
  color: "#82edb5",
} as const;

const errorBox = {
  padding: 14,
  border: "1px solid rgba(255,103,103,.25)",
  borderRadius: 14,
  background: "rgba(255,103,103,.08)",
  color: "#ff9c9c",
} as const;

const empty = {
  padding: 22,
  border: "1px dashed var(--border)",
  borderRadius: 14,
  color: "var(--muted)",
  lineHeight: 1.6,
} as const;

const integrity = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
  padding: 20,
  border: "1px solid rgba(24,167,224,.20)",
  borderRadius: 18,
  background: "rgba(24,167,224,.055)",
} as const;

const muted = {
  color: "var(--muted)",
  lineHeight: 1.65,
} as const;
