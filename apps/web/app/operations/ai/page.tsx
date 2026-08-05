import type {Metadata} from "next";
import type {ReactNode} from "react";
import Link from "next/link";
import {
  runSmartOperationsAnalysisAction,
  updateSmartFindingStatusAction
} from "./actions";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";
import {
  getSmartOperationsData,
  type SmartOperationsFindingRow
} from "@/lib/operations/getSmartOperationsData";

export const metadata: Metadata = {
  title: "Smart Operations AI | KVA OS",
  description: "Explainable operational intelligence for virtual airlines."
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
    timeStyle: "short"
  }).format(new Date(value));
}

function scoreLabel(score: number) {
  if (score >= 90) return "Healthy";
  if (score >= 70) return "Watch";
  if (score >= 40) return "Degraded";
  return "Critical";
}

export default async function SmartOperationsAiPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await requireOperationsConsoleAdmin();
  const params = await searchParams;
  const message = first(params.message);
  const errorMessage = first(params.error);
  const data = await getSmartOperationsData();

  return (
    <main style={{minHeight:"100vh",background:"var(--bg)"}}>
      <section style={{
        padding:"72px 20px 112px",
        background:
          "radial-gradient(circle at 78% 24%,rgba(0,174,239,.24),transparent 30%),linear-gradient(145deg,#06152d,#0b2344 58%,#124d79)"
      }}>
        <div style={{maxWidth:1180,margin:"0 auto"}}>
          <div style={{
            display:"flex",
            justifyContent:"space-between",
            gap:22,
            alignItems:"flex-start",
            flexWrap:"wrap"
          }}>
            <div>
              <Link
                href="/operations"
                style={{color:"var(--accent)",fontWeight:850}}
              >
                ← Operations Center
              </Link>
              <p className="eyebrow" style={{marginTop:34}}>
                KVA OS · Pillar 02
              </p>
              <h1 style={{
                margin:"12px 0 18px",
                fontSize:"clamp(3.4rem,8vw,6.3rem)",
                lineHeight:.92,
                letterSpacing:"-.06em"
              }}>
                Smart Operations AI
              </h1>
              <p style={{
                maxWidth:800,
                margin:0,
                color:"var(--muted)",
                lineHeight:1.8
              }}>
                Explainable operational intelligence that detects risks,
                presents evidence and recommends actions without changing
                flights automatically.
              </p>
            </div>

            <form action={runSmartOperationsAnalysisAction}>
              <button className="button" type="submit" style={{marginTop:8}}>
                Run analysis
              </button>
            </form>
          </div>
        </div>
      </section>

      <section style={{padding:"0 20px 100px"}}>
        <div style={{
          maxWidth:1180,
          margin:"0 auto",
          display:"grid",
          gap:22,
          transform:"translateY(-42px)"
        }}>
          {message ? <Notice success>{message}</Notice> : null}
          {errorMessage ? <Notice>{errorMessage}</Notice> : null}

          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",
            gap:12
          }}>
            <Stat
              label="Health Score"
              value={`${data.healthScore}/100`}
              subValue={scoreLabel(data.healthScore)}
            />
            <Stat
              label="Active Findings"
              value={String(data.activeFindings.length)}
              subValue="Open + acknowledged"
            />
            <Stat
              label="Critical"
              value={String(data.severityCounts.critical)}
              subValue="Immediate attention"
            />
            <Stat
              label="High"
              value={String(data.severityCounts.high)}
              subValue="Priority action"
            />
            <Stat
              label="Rules"
              value={String(data.policies.filter((policy) => policy.enabled).length)}
              subValue="Explainable policies"
            />
          </div>

          <section style={panelStyle}>
            <div style={{
              display:"flex",
              justifyContent:"space-between",
              gap:18,
              alignItems:"flex-end",
              flexWrap:"wrap"
            }}>
              <div>
                <p className="eyebrow">Latest Analysis</p>
                <h2 style={{margin:"8px 0 0"}}>
                  Operational Intelligence Run
                </h2>
              </div>

              <Link
                href="/operations/events/core-health"
                style={{color:"var(--accent)",fontWeight:850}}
              >
                Open Core Health →
              </Link>
            </div>

            {data.latestRun ? (
              <div style={{
                display:"grid",
                gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",
                gap:12,
                marginTop:20
              }}>
                <MiniStat
                  label="Status"
                  value={data.latestRun.status}
                />
                <MiniStat
                  label="Started"
                  value={formatDate(data.latestRun.started_at)}
                />
                <MiniStat
                  label="Rules Evaluated"
                  value={String(data.latestRun.rules_evaluated)}
                />
                <MiniStat
                  label="Opened"
                  value={String(data.latestRun.findings_opened)}
                />
                <MiniStat
                  label="Refreshed"
                  value={String(data.latestRun.findings_refreshed)}
                />
                <MiniStat
                  label="Auto-resolved"
                  value={String(data.latestRun.findings_auto_resolved)}
                />
              </div>
            ) : (
              <p style={mutedStyle}>
                No analysis run has been recorded yet.
              </p>
            )}
          </section>

          <section style={panelStyle}>
            <div style={{
              display:"flex",
              justifyContent:"space-between",
              gap:18,
              alignItems:"flex-end",
              flexWrap:"wrap"
            }}>
              <div>
                <p className="eyebrow">Decision Support</p>
                <h2 style={{margin:"8px 0 0"}}>Operational Findings</h2>
              </div>
              <span style={mutedStyle}>
                Recommendations require human approval.
              </span>
            </div>

            <div style={{display:"grid",gap:14,marginTop:20}}>
              {data.findings.length ? data.findings.map((finding) => (
                <FindingCard key={finding.id} finding={finding} />
              )) : (
                <div style={emptyStyle}>
                  No operational risks were detected.
                </div>
              )}
            </div>
          </section>

          <section style={panelStyle}>
            <p className="eyebrow">Explainability</p>
            <h2>Active Policies</h2>
            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",
              gap:12,
              marginTop:18
            }}>
              {data.policies.map((policy) => (
                <article key={policy.policy_key} style={miniCardStyle}>
                  <strong>{policy.policy_key.replaceAll("_", " ")}</strong>
                  <small style={mutedStyle}>
                    {policy.enabled ? "Enabled" : "Disabled"} · {policy.severity}
                  </small>
                  <pre style={preStyle}>
                    {JSON.stringify(policy.configuration, null, 2)}
                  </pre>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function FindingCard({finding}: {finding: SmartOperationsFindingRow}) {
  return (
    <article style={{
      padding:20,
      border:"1px solid rgba(105,183,231,.15)",
      borderRadius:16,
      background:"rgba(4,16,32,.34)"
    }}>
      <div style={{
        display:"flex",
        justifyContent:"space-between",
        alignItems:"flex-start",
        gap:18,
        flexWrap:"wrap"
      }}>
        <div style={{maxWidth:760}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Badge value={finding.severity} />
            <Badge value={finding.status} />
            <Badge value={`${Math.round(Number(finding.confidence) * 100)}% confidence`} />
          </div>

          <h3 style={{margin:"14px 0 8px",fontSize:"1.35rem"}}>
            {finding.title}
          </h3>
          <p style={{margin:"0 0 12px",color:"var(--muted)",lineHeight:1.7}}>
            {finding.summary}
          </p>
          <strong style={{display:"block",color:"var(--accent)"}}>
            Recommended action
          </strong>
          <p style={{margin:"6px 0 0",lineHeight:1.7}}>
            {finding.recommendation}
          </p>
        </div>

        <div style={{
          minWidth:210,
          display:"grid",
          gap:8,
          color:"var(--muted)",
          fontSize:".82rem"
        }}>
          <span>{finding.finding_type}</span>
          <span>{finding.subject_type}: {finding.subject_id ?? "platform"}</span>
          <span>Detected: {formatDate(finding.last_detected_at)}</span>
        </div>
      </div>

      <details style={{marginTop:16}}>
        <summary style={{color:"var(--accent)",fontWeight:850,cursor:"pointer"}}>
          Inspect evidence
        </summary>
        <pre style={preStyle}>
          {JSON.stringify(finding.evidence, null, 2)}
        </pre>
      </details>

      <div style={{
        display:"flex",
        gap:9,
        flexWrap:"wrap",
        marginTop:16
      }}>
        {finding.status === "open" ? (
          <StatusForm
            findingId={finding.id}
            status="acknowledged"
            label="Acknowledge"
          />
        ) : null}

        {finding.status !== "resolved" ? (
          <StatusForm
            findingId={finding.id}
            status="resolved"
            label="Resolve"
            includeNote
          />
        ) : (
          <StatusForm
            findingId={finding.id}
            status="open"
            label="Reopen"
          />
        )}
      </div>
    </article>
  );
}

function StatusForm({
  findingId,
  status,
  label,
  includeNote = false
}: {
  findingId: string;
  status: "open" | "acknowledged" | "resolved";
  label: string;
  includeNote?: boolean;
}) {
  return (
    <form
      action={updateSmartFindingStatusAction}
      style={{display:"flex",gap:8,flexWrap:"wrap"}}
    >
      <input type="hidden" name="findingId" value={findingId} />
      <input type="hidden" name="status" value={status} />
      {includeNote ? (
        <input
          name="note"
          placeholder="Resolution note"
          style={inputStyle}
        />
      ) : null}
      <button className="button" type="submit">
        {label}
      </button>
    </form>
  );
}

function Badge({value}: {value:string}) {
  return (
    <span style={{
      padding:"6px 9px",
      borderRadius:999,
      color:"var(--text)",
      background:"rgba(255,255,255,.075)",
      fontSize:".72rem",
      fontWeight:850,
      textTransform:"uppercase"
    }}>
      {value}
    </span>
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

function Stat({
  label,
  value,
  subValue
}: {
  label:string;
  value:string;
  subValue:string;
}) {
  return (
    <article style={{
      minHeight:130,
      padding:21,
      border:"1px solid var(--border)",
      borderRadius:17,
      background:"var(--surface)"
    }}>
      <small style={{
        color:"var(--muted)",
        fontWeight:850,
        letterSpacing:".06em"
      }}>
        {label.toUpperCase()}
      </small>
      <strong style={{
        display:"block",
        marginTop:15,
        fontSize:"2rem",
        textTransform:"capitalize"
      }}>
        {value}
      </strong>
      <span style={{display:"block",marginTop:7,color:"var(--muted)",fontSize:".78rem"}}>
        {subValue}
      </span>
    </article>
  );
}

function MiniStat({label, value}: {label:string; value:string}) {
  return (
    <article style={miniCardStyle}>
      <small style={{color:"var(--muted)",fontWeight:850}}>
        {label.toUpperCase()}
      </small>
      <strong style={{
        display:"block",
        marginTop:8,
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
  padding:17,
  border:"1px solid rgba(105,183,231,.13)",
  borderRadius:14,
  background:"rgba(4,16,32,.32)"
} as const;

const emptyStyle = {
  padding:30,
  border:"1px dashed var(--border)",
  borderRadius:14,
  color:"var(--muted)",
  textAlign:"center"
} as const;

const mutedStyle = {
  color:"var(--muted)",
  lineHeight:1.7
} as const;

const inputStyle = {
  minHeight:42,
  minWidth:220,
  padding:"0 12px",
  border:"1px solid var(--border)",
  borderRadius:10,
  color:"inherit",
  background:"rgba(4,16,32,.44)"
} as const;

const preStyle = {
  maxHeight:260,
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
