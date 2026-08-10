import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {getOperationsData} from "@/lib/operations/getOperationsData";
import {isOperationsConsoleAdminEmail} from "@/lib/operations/console-auth";
import {OperationsStats} from "@/components/operations/OperationsStats";
import {LiveFlights} from "@/components/operations/LiveFlights";
import {FleetSummary} from "@/components/operations/FleetSummary";
import {RecentPireps} from "@/components/operations/RecentPireps";

export const metadata: Metadata = {
  title: "Operations Center | Kalabsha Airlines",
  description: "Fleet, live flights and PIREP operations overview."
};

export default async function OperationsPage() {
  const supabase = await createClient();

  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/pilots/login");
  }

  const data = await getOperationsData();
  const canOpenEventConsole = isOperationsConsoleAdminEmail(user.email);

  return (
    <main style={{minHeight:"100vh",background:"var(--bg)"}}>
      <section style={{
        padding:"76px 0 106px",
        background:"radial-gradient(circle at 78% 30%, rgba(0,174,239,.22), transparent 28%), linear-gradient(145deg,#06152d,#0b2344 58%,#124d79)"
      }}>
        <div className="container">
          <div style={{
            display:"flex",
            justifyContent:"space-between",
            alignItems:"flex-start",
            gap:20,
            flexWrap:"wrap"
          }}>
            <div>
              <p className="eyebrow">Kalabsha Operations</p>
              <h1 style={{
                margin:"14px 0 18px",
                fontSize:"clamp(3.2rem,7vw,6rem)",
                lineHeight:.95,
                letterSpacing:"-.055em"
              }}>
                Operations Center
              </h1>
            </div>

            {canOpenEventConsole ? (
              <div style={{
                display:"flex",
                gap:10,
                marginTop:8,
                flexWrap:"wrap"
              }}>
                <Link className="button" href="/operations/ai">
                  Open Smart Operations AI
                </Link>
                <Link className="button outline" href="/operations/replay">
                  Open Black Box Replay
                </Link>
                <Link className="button outline" href="/operations/events">
                  Open Event Console
                </Link>
                <Link className="button outline" href="/operations/global-events">
                  Manage Global Events
                </Link>
              </div>
            ) : null}
          </div>

          <p style={{
            maxWidth:760,
            margin:0,
            color:"var(--muted)",
            fontSize:"1.05rem",
            lineHeight:1.8
          }}>
            Live fleet availability, active flights and recent flight reports
            from the Kalabsha Airlines operational database.
          </p>
        </div>
      </section>

      <section style={{padding:"0 0 100px"}}>
        <div className="container">
          <div style={{transform:"translateY(-38px)"}}>
            <OperationsStats stats={data.stats} />
          </div>

          <div style={{display:"grid",gap:22,marginTop:-12}}>
            <LiveFlights flights={data.liveFlights} />
            <FleetSummary items={data.fleetSummary} />
            <RecentPireps items={data.recentPireps} />
          </div>
        </div>
      </section>
    </main>
  );
}
