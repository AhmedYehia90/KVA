import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

type PassportData = {
  passportNumber: string;
  publicSlug: string;
  issuedAt: string;
  fullName: string;
  callsign: string;
  totalHours: number;
  totalFlights: number;
  currentRank: {code: string; name: string};
  memberships: Array<{
    organizationId: string;
    organizationCode: string;
    organizationName: string;
    role: string;
    status: string;
    joinedAt: string;
    isPrimary: boolean;
  }>;
  qualifications: Array<{
    code: string;
    name: string;
    status: string;
    issuedAt: string;
    expiresAt: string | null;
    aircraftType: string | null;
  }>;
  experience: {
    flights: number;
    hours: number;
    verifiedFlights: number;
    verifiedHours: number;
  };
};

export async function generateMetadata({
  params
}: {
  params: Promise<{slug: string}>;
}): Promise<Metadata> {
  const {slug} = await params;
  return {
    title: `${slug} | Universal Pilot Passport`,
    description: "A public KVA OS Universal Pilot Passport."
  };
}

export const dynamic = "force-dynamic";

export default async function PublicPassportPage({
  params
}: {
  params: Promise<{slug: string}>;
}) {
  const {slug} = await params;
  const supabase = await createClient();
  const {data, error} = await supabase.rpc("get_public_pilot_passport", {
    p_slug: slug
  });

  if (error) {
    throw new Error(`Unable to load public passport: ${error.message}`);
  }

  if (!data) notFound();

  const passport = data as unknown as PassportData;

  return (
    <main style={{minHeight:"100vh",padding:"72px 20px 100px",background:"var(--bg)"}}>
      <section style={{maxWidth:1060,margin:"0 auto"}}>
        <p className="eyebrow">KVA OS · Universal Pilot Passport</p>
        <h1 style={{fontSize:"clamp(3.4rem,8vw,6rem)",margin:"12px 0"}}>
          {passport.fullName}
        </h1>
        <p style={{fontSize:"1.15rem",color:"var(--muted)"}}>
          {passport.callsign} · {passport.currentRank.name}
        </p>

        <div style={{marginTop:24,padding:18,border:"1px solid var(--border)",borderRadius:15,background:"var(--surface)"}}>
          <small style={{display:"block",color:"var(--muted)",fontWeight:850}}>PASSPORT NUMBER</small>
          <strong style={{display:"block",marginTop:7,fontFamily:"monospace"}}>
            {passport.passportNumber}
          </strong>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginTop:24}}>
          <Stat label="Platform Hours" value={String(Number(passport.totalHours).toFixed(1))} />
          <Stat label="Platform Flights" value={String(passport.totalFlights)} />
          <Stat label="Portable Hours" value={String(passport.experience.hours)} />
          <Stat label="Verified Hours" value={String(passport.experience.verifiedHours)} />
          <Stat label="Airlines" value={String(passport.memberships.length)} />
        </div>

        <section style={panelStyle}>
          <p className="eyebrow">Network Career</p>
          <h2>Airline Memberships</h2>
          <div style={{display:"grid",gap:12}}>
            {passport.memberships.map((membership) => (
              <article key={membership.organizationId} style={cardStyle}>
                <div>
                  <strong>{membership.organizationName}</strong>
                  <small style={mutedStyle}>
                    {membership.organizationCode} · {membership.role}
                  </small>
                </div>
                <span style={mutedStyle}>
                  {membership.isPrimary ? "Primary Airline" : membership.status}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <p className="eyebrow">Portable Credentials</p>
          <h2>Qualifications</h2>
          <div style={{display:"grid",gap:12}}>
            {passport.qualifications.length ? passport.qualifications.map((qualification) => (
              <article key={`${qualification.code}-${qualification.issuedAt}`} style={cardStyle}>
                <div>
                  <strong>{qualification.name}</strong>
                  <small style={mutedStyle}>
                    {qualification.code}
                    {qualification.aircraftType ? ` · ${qualification.aircraftType}` : ""}
                  </small>
                </div>
                <span style={mutedStyle}>{qualification.status}</span>
              </article>
            )) : <p style={mutedStyle}>No public qualifications recorded.</p>}
          </div>
        </section>

        <p style={{marginTop:28,color:"var(--muted)",fontSize:".85rem"}}>
          Issued {new Intl.DateTimeFormat("en-GB", {dateStyle:"long"}).format(new Date(passport.issuedAt))}
        </p>
      </section>
    </main>
  );
}

const panelStyle = {
  marginTop:22,
  padding:22,
  border:"1px solid var(--border)",
  borderRadius:18,
  background:"var(--surface)"
} as const;

const cardStyle = {
  display:"flex",
  justifyContent:"space-between",
  alignItems:"center",
  gap:18,
  padding:17,
  border:"1px solid rgba(105,183,231,.13)",
  borderRadius:14,
  background:"rgba(4,16,32,.32)"
} as const;

const mutedStyle = {
  display:"block",
  marginTop:5,
  color:"var(--muted)"
} as const;

function Stat({label, value}: {label:string; value:string}) {
  return (
    <article style={{padding:20,border:"1px solid var(--border)",borderRadius:16,background:"var(--surface)"}}>
      <small style={{color:"var(--muted)",fontWeight:850}}>{label.toUpperCase()}</small>
      <strong style={{display:"block",marginTop:12,fontSize:"1.5rem"}}>{value}</strong>
    </article>
  );
}
