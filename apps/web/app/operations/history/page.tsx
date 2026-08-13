import type {Metadata} from "next";
import Link from "next/link";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {
  createHistoryEntryAction,
  setHistoryPublicationAction,
  updateHistoryEntryAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Museum Curator | KVA OS",
  description: "Operations administration for curated airline history.",
};

export const dynamic = "force-dynamic";

const ORG = "kalabsha-airlines";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Entry = {
  id: string;
  organization_id: string;
  category: string;
  title: string;
  summary: string;
  details: string | null;
  occurred_on: string | null;
  era_label: string | null;
  evidence: Record<string, unknown> | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type Audit = {
  id: string;
  action: string;
  history_entry_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const categories = [
  ["company_history", "Company History"],
  ["fleet_history", "Fleet History"],
  ["network_history", "Network History"],
  ["community_history", "Community History"],
  ["event_history", "Event History"],
  ["technology_history", "Technology History"],
  ["other", "Other"],
] as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function evidenceText(
  evidence: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = evidence?.[key];
  return typeof value === "string" ? value : "";
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function MuseumCuratorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOperationsConsoleAdmin();

  const query = await searchParams;
  const admin = createAdminClient();

  const [entriesResult, auditsResult] = await Promise.all([
    admin
      .from("museum_company_history_entries")
      .select("*")
      .eq("organization_id", ORG)
      .order("created_at", {ascending: false}),
    admin
      .from("museum_history_admin_audit")
      .select("id,action,history_entry_id,details,created_at")
      .eq("organization_id", ORG)
      .order("created_at", {ascending: false})
      .limit(30),
  ]);

  if (entriesResult.error) {
    throw new Error(
      `Unable to load curated history: ${entriesResult.error.message}`,
    );
  }

  if (auditsResult.error) {
    throw new Error(
      `Unable to load Museum audit history: ${auditsResult.error.message}`,
    );
  }

  const entries = (entriesResult.data ?? []) as Entry[];
  const audits = (auditsResult.data ?? []) as Audit[];

  const published = entries.filter((entry) => entry.is_published).length;
  const drafts = entries.length - published;

  return (
    <main style={{minHeight: "100vh", background: "var(--bg)"}}>
      <section
        style={{
          padding: "72px 20px 108px",
          background:
            "radial-gradient(circle at 80% 20%,rgba(0,174,239,.24),transparent 30%),linear-gradient(145deg,#06152d,#0b2344 58%,#124d79)",
        }}
      >
        <div style={{maxWidth: 1180, margin: "0 auto"}}>
          <div style={{display: "flex", gap: 14, flexWrap: "wrap"}}>
            <Link href="/operations" style={topLink}>
              ← Operations Center
            </Link>
            <Link href="/pilot/history/company" style={topLink}>
              Open Airline Museum →
            </Link>
          </div>

          <p className="eyebrow" style={{marginTop: 30}}>
            KVA OS · PILLAR 09 · OPERATIONS AUTHORITY
          </p>
          <h1 style={heroTitle}>Museum Curator</h1>
          <p style={heroText}>
            Create and maintain official company-history narratives without
            rewriting operational evidence. Drafts stay private to Operations;
            only published entries appear in Airline Museum.
          </p>
        </div>
      </section>

      <section style={{padding: "0 20px 100px"}}>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "grid",
            gap: 22,
            transform: "translateY(-42px)",
          }}
        >
          {first(query.message) ? (
            <div style={success}>{first(query.message)}</div>
          ) : null}

          {first(query.error) ? (
            <div style={errorBox}>{first(query.error)}</div>
          ) : null}

          <div style={stats}>
            <Stat label="TOTAL CURATED ENTRIES" value={String(entries.length)} />
            <Stat label="DRAFT" value={String(drafts)} />
            <Stat label="PUBLISHED" value={String(published)} />
            <Stat
              label="AIRLINE"
              value="Kalabsha Airlines"
              small
            />
          </div>

          <section style={panel}>
            <p className="eyebrow">NEW OFFICIAL HISTORY</p>
            <h2 style={sectionTitle}>Create a curated history draft</h2>
            <p style={muted}>
              This is narrative company history. It is not an operational
              event, fleet command, route decision or economy transaction.
            </p>

            <form action={createHistoryEntryAction} style={formGrid}>
              <Field label="Title" name="title" required />
              <Field label="Era label" name="eraLabel" placeholder="Founding Era" />
              <SelectField label="Category" name="category" />
              <Field label="Occurred on" name="occurredOn" type="date" />
              <TextArea
                label="Summary"
                name="summary"
                required
                placeholder="Short museum description shown on the timeline."
              />
              <TextArea
                label="Details"
                name="details"
                placeholder="Long-form context, significance or historical notes."
              />
              <Field
                label="Source label"
                name="sourceLabel"
                placeholder="Official announcement / archive / board note"
              />
              <Field
                label="Source reference"
                name="sourceReference"
                placeholder="Reference text or URL identifier"
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
                <p className="eyebrow">CURATED HISTORY LIBRARY</p>
                <h2 style={sectionTitle}>Drafts and published stories</h2>
              </div>
              <span style={authorityBadge}>OPERATIONS CURATOR</span>
            </div>

            <div style={{display: "grid", gap: 16, marginTop: 22}}>
              {entries.length ? (
                entries.map((entry) => (
                  <article key={entry.id} style={entryCard}>
                    <div style={entryTop}>
                      <div>
                        <span
                          style={
                            entry.is_published ? publishedBadge : draftBadge
                          }
                        >
                          {entry.is_published ? "PUBLISHED" : "DRAFT"}
                        </span>
                        <h3 style={{margin: "10px 0 4px", fontSize: "1.28rem"}}>
                          {entry.title}
                        </h3>
                        <small style={{color: "var(--muted)"}}>
                          {entry.category.replaceAll("_", " ")}
                          {entry.occurred_on ? ` · ${entry.occurred_on}` : ""}
                          {entry.era_label ? ` · ${entry.era_label}` : ""}
                        </small>
                      </div>

                      <form action={setHistoryPublicationAction}>
                        <input type="hidden" name="entryId" value={entry.id} />
                        <input
                          type="hidden"
                          name="publish"
                          value={entry.is_published ? "false" : "true"}
                        />
                        <button className="button outline" type="submit">
                          {entry.is_published ? "Return to Draft" : "Publish"}
                        </button>
                      </form>
                    </div>

                    <form
                      action={updateHistoryEntryAction}
                      style={{...formGrid, marginTop: 18}}
                    >
                      <input type="hidden" name="entryId" value={entry.id} />

                      <Field
                        label="Title"
                        name="title"
                        defaultValue={entry.title}
                        required
                      />
                      <Field
                        label="Era label"
                        name="eraLabel"
                        defaultValue={entry.era_label ?? ""}
                      />
                      <SelectField
                        label="Category"
                        name="category"
                        defaultValue={entry.category}
                      />
                      <Field
                        label="Occurred on"
                        name="occurredOn"
                        type="date"
                        defaultValue={entry.occurred_on ?? ""}
                      />
                      <TextArea
                        label="Summary"
                        name="summary"
                        defaultValue={entry.summary}
                        required
                      />
                      <TextArea
                        label="Details"
                        name="details"
                        defaultValue={entry.details ?? ""}
                      />
                      <Field
                        label="Source label"
                        name="sourceLabel"
                        defaultValue={evidenceText(
                          entry.evidence,
                          "sourceLabel",
                        )}
                      />
                      <Field
                        label="Source reference"
                        name="sourceReference"
                        defaultValue={evidenceText(
                          entry.evidence,
                          "sourceReference",
                        )}
                      />

                      <div style={{gridColumn: "1 / -1"}}>
                        <button className="button outline" type="submit">
                          Save Changes
                        </button>
                      </div>
                    </form>
                  </article>
                ))
              ) : (
                <div style={empty}>
                  No curated company history exists yet. Create the first Draft
                  above, review it, then Publish it to Airline Museum.
                </div>
              )}
            </div>
          </section>

          <section style={panel}>
            <p className="eyebrow">CURATOR AUDIT</p>
            <h2 style={sectionTitle}>Administrative history</h2>

            <div style={{display: "grid", gap: 10, marginTop: 18}}>
              {audits.length ? (
                audits.map((audit) => (
                  <div key={audit.id} style={auditRow}>
                    <div>
                      <strong style={{textTransform: "capitalize"}}>
                        {audit.action.replaceAll("_", " ")}
                      </strong>
                      <span style={auditSub}>
                        {audit.history_entry_id
                          ? `Entry ${audit.history_entry_id.slice(0, 8)}…`
                          : "History entry"}
                      </span>
                    </div>
                    <time style={{color: "var(--muted)", fontSize: ".8rem"}}>
                      {dateTime(audit.created_at)}
                    </time>
                  </div>
                ))
              ) : (
                <div style={empty}>No curator audit records yet.</div>
              )}
            </div>
          </section>

          <section style={integrity}>
            <strong>Curated history is narrative, not authority.</strong>
            <span style={{color: "var(--muted)"}}>
              Publishing a museum story never changes Fleet, Route activation,
              PIREPs, Career XP, wallets, Company KVC or Economy Ledger.
            </span>
          </section>
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div style={statCard}>
      <small style={fieldLabel}>{label}</small>
      <strong
        style={{
          display: "block",
          marginTop: 9,
          fontSize: small ? "1rem" : "1.7rem",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label style={fieldWrap}>
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
  label,
  name,
  placeholder,
  defaultValue,
  required = false,
}: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label style={{...fieldWrap, gridColumn: "span 2"}}>
      <span style={fieldLabel}>{label}</span>
      <textarea
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        rows={4}
        style={{...input, resize: "vertical", lineHeight: 1.5}}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue = "company_history",
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label style={fieldWrap}>
      <span style={fieldLabel}>{label}</span>
      <select name={name} defaultValue={defaultValue} style={input}>
        {categories.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

const topLink = {
  color: "var(--accent)",
  fontWeight: 850,
} as const;

const heroTitle = {
  fontSize: "clamp(3rem,7vw,5.8rem)",
  margin: "10px 0 14px",
  letterSpacing: "-.055em",
} as const;

const heroText = {
  maxWidth: 840,
  margin: 0,
  color: "var(--muted)",
  lineHeight: 1.8,
  fontSize: "1.04rem",
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

const muted = {
  color: "var(--muted)",
  lineHeight: 1.65,
} as const;

const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 14,
  marginTop: 20,
} as const;

const fieldWrap = {
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

const sectionHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  gap: 16,
  flexWrap: "wrap",
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

const entryCard = {
  padding: 20,
  border: "1px solid rgba(105,183,231,.17)",
  borderRadius: 18,
  background: "rgba(4,16,32,.22)",
} as const;

const entryTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
  flexWrap: "wrap",
} as const;

const publishedBadge = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(57,220,138,.10)",
  color: "#82edb5",
  fontSize: ".68rem",
  fontWeight: 900,
} as const;

const draftBadge = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(255,191,72,.10)",
  color: "#ffd27a",
  fontSize: ".68rem",
  fontWeight: 900,
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

const auditSub = {
  display: "block",
  marginTop: 4,
  color: "var(--muted)",
  fontSize: ".78rem",
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
