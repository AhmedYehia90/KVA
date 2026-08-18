import type {Metadata} from "next";
import type {ReactNode} from "react";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {updatePassportVisibilityAction} from "./actions";

export const metadata: Metadata = {
  title: "Universal Pilot Passport | KVA OS",
  description: "Portable pilot identity, memberships and verified experience."
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function hours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

export default async function PilotPassportPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const message = first(params.message);
  const errorMessage = first(params.error);
  const supabase = await createClient();

  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const [passportResult, profileResult, membershipResult, qualificationResult, experienceResult] =
    await Promise.all([
      supabase
        .from("pilot_passports")
        .select("passport_number,public_slug,visibility,status,bio,issued_at")
        .eq("pilot_id", user.id)
        .single(),
      supabase
        .from("profiles")
        .select("callsign,full_name,total_hours,total_flights,ranks(code,name)")
        .eq("id", user.id)
        .single(),
      supabase
        .from("pilot_airline_memberships")
        .select(
          "id,callsign,employee_number,role,status,is_primary,joined_at,organization:platform_organizations(code,name,slug)"
        )
        .eq("pilot_id", user.id)
        .order("is_primary", {ascending: false}),
      supabase
        .from("pilot_qualifications")
        .select(
          "id,qualification_code,qualification_name,status,issued_at,expires_at,fleet_type:fleet_types(icao_code,manufacturer,model)"
        )
        .eq("pilot_id", user.id)
        .order("issued_at", {ascending: false}),
      supabase
        .from("pilot_experience_ledger")
        .select(
          "id,organization_id,flight_number,block_minutes,pirep_status,flown_at,departure:airports!pilot_experience_ledger_departure_airport_id_fkey(icao_code),arrival:airports!pilot_experience_ledger_arrival_airport_id_fkey(icao_code)"
        )
        .eq("pilot_id", user.id)
        .order("flown_at", {ascending: false})
        .limit(20)
    ]);

  const firstError =
    passportResult.error ??
    profileResult.error ??
    membershipResult.error ??
    qualificationResult.error ??
    experienceResult.error;

if (firstError || !passportResult.data || !profileResult.data) {
  throw new Error(
    `Unable to load Universal Pilot Passport: ${
      firstError?.message ?? "Passport or pilot profile not found."
    }`
  );
}

  const passport = passportResult.data;
  const profile = profileResult.data;
  const memberships = membershipResult.data ?? [];
  const qualifications = qualificationResult.data ?? [];
  const experience = experienceResult.data ?? [];

  const totalMinutes = experience.reduce(
    (sum, item) => sum + Number(item.block_minutes ?? 0),
    0
  );
  const verifiedMinutes = experience
    .filter((item) => item.pirep_status === "approved")
    .reduce((sum, item) => sum + Number(item.block_minutes ?? 0), 0);

  return (
    <main className="kvaPassportPage" style={{minHeight:"100vh",padding:"72px 20px 100px",background:"var(--bg)"}}>
      <section style={{maxWidth:1180,margin:"0 auto"}}>
        <Link href="/pilot/dashboard" style={{color:"var(--accent)",fontWeight:850}}>
          ← Pilot Dashboard
        </Link>

        <div style={{display:"flex",justifyContent:"space-between",gap:24,alignItems:"flex-end",flexWrap:"wrap",marginTop:34}}>
          <div>
            <p className="eyebrow">KVA OS · Universal Identity</p>
            <h1 style={{fontSize:"clamp(3.4rem,8vw,6rem)",margin:"12px 0"}}>
              Universal Pilot Passport
            </h1>
            <p style={{maxWidth:760,color:"var(--muted)",lineHeight:1.8}}>
              One portable pilot identity across every airline operating on KVA OS.
            </p>
          </div>

          <div className="kvaPassportIdentityCard" style={{padding:"14px 18px",border:"1px solid var(--border)",borderRadius:14,background:"var(--surface)"}}>
            <small style={{display:"block",color:"var(--muted)",fontWeight:850}}>PASSPORT NUMBER</small>
            <strong style={{display:"block",marginTop:7,fontFamily:"monospace"}}>
              {passport.passport_number}
            </strong>
          </div>
        </div>

        {message ? <Notice success>{message}</Notice> : null}
        {errorMessage ? <Notice>{errorMessage}</Notice> : null}

        <div className="kvaPassportStatsGrid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,marginTop:28}}>
          <Stat label="Pilot" value={profile.full_name} />
          <Stat label="Callsign" value={profile.callsign} />
          <Stat label="Platform Hours" value={String(Number(profile.total_hours ?? 0).toFixed(1))} />
          <Stat label="Platform Flights" value={String(profile.total_flights ?? 0)} />
          <Stat label="Portable Hours" value={String(hours(totalMinutes))} />
          <Stat label="Verified Hours" value={String(hours(verifiedMinutes))} />
        </div>

        <section style={panelStyle}>
          <div style={{display:"flex",justifyContent:"space-between",gap:18,alignItems:"center",flexWrap:"wrap"}}>
            <div>
              <p className="eyebrow">Privacy</p>
              <h2 style={{margin:"8px 0 0"}}>Passport Visibility</h2>
            </div>

            <form action={updatePassportVisibilityAction} style={{display:"flex",gap:9,flexWrap:"wrap"}}>
              <select name="visibility" defaultValue={passport.visibility} style={inputStyle}>
                <option value="private">Private</option>
                <option value="network">KVA Network</option>
                <option value="public">Public</option>
              </select>
              <button className="button" type="submit">Save</button>
            </form>
          </div>

          <p style={{color:"var(--muted)",lineHeight:1.7}}>
            Public passports can be shared using:
            {" "}
            <Link href={`/passport/${passport.public_slug}`} style={{color:"var(--accent)"}}>
              /passport/{passport.public_slug}
            </Link>
          </p>
        </section>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(340px,1fr))",gap:18}}>
          <section style={panelStyle}>
            <p className="eyebrow">Airline Network</p>
            <h2>Memberships</h2>
            <div style={{display:"grid",gap:12}}>
              {memberships.map((membership) => {
                const organization = Array.isArray(membership.organization)
                  ? membership.organization[0]
                  : membership.organization;
                return (
                  <article key={membership.id} style={cardStyle}>
                    <div>
                      <strong>{organization?.name ?? "Unknown Airline"}</strong>
                      <small style={mutedStyle}>
                        {organization?.code ?? "—"} · {membership.role}
                      </small>
                    </div>
                    <span style={mutedStyle}>
                      {membership.is_primary ? "Primary" : membership.status}
                    </span>
                  </article>
                );
              })}
            </div>
          </section>

          <section style={panelStyle}>
            <p className="eyebrow">Portable Credentials</p>
            <h2>Qualifications</h2>
            <div style={{display:"grid",gap:12}}>
              {qualifications.length ? qualifications.map((qualification) => (
                <article key={qualification.id} style={cardStyle}>
                  <div>
                    <strong>{qualification.qualification_name}</strong>
                    <small style={mutedStyle}>{qualification.qualification_code}</small>
                  </div>
                  <span style={mutedStyle}>{qualification.status}</span>
                </article>
              )) : <p style={mutedStyle}>No portable qualifications recorded yet.</p>}
            </div>
          </section>
        </div>

        <section style={panelStyle}>
          <p className="eyebrow">Flight CV</p>
          <h2>Portable Experience Ledger</h2>
          <div style={{display:"grid",gap:12}}>
            {experience.length ? experience.map((entry) => {
              const departure = Array.isArray(entry.departure) ? entry.departure[0] : entry.departure;
              const arrival = Array.isArray(entry.arrival) ? entry.arrival[0] : entry.arrival;
              return (
                <article key={entry.id} style={cardStyle}>
                  <div>
                    <strong>{entry.flight_number}</strong>
                    <small style={mutedStyle}>
                      {departure?.icao_code ?? "—"} → {arrival?.icao_code ?? "—"}
                    </small>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <strong>{entry.block_minutes} min</strong>
                    <small style={mutedStyle}>{entry.pirep_status}</small>
                  </div>
                </article>
              );
            }) : <p style={mutedStyle}>No portable flight experience recorded yet.</p>}
          </div>
        </section>
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

const inputStyle = {
  minHeight:42,
  padding:"0 12px",
  border:"1px solid var(--border)",
  borderRadius:10,
  color:"inherit",
  background:"rgba(4,16,32,.44)"
} as const;

const mutedStyle = {
  display:"block",
  marginTop:5,
  color:"var(--muted)"
} as const;

function Notice({children, success = false}: {children:ReactNode; success?:boolean}) {
  return (
    <div style={{
      marginTop:18,
      padding:15,
      borderRadius:12,
      color:success ? "#98efbf" : "#ffb1b1",
      background:success ? "rgba(57,220,138,.1)" : "rgba(255,95,95,.1)"
    }}>
      {children}
    </div>
  );
}

function Stat({label, value}: {label:string; value:string}) {
  return (
    <article style={{padding:20,border:"1px solid var(--border)",borderRadius:16,background:"var(--surface)"}}>
      <small style={{color:"var(--muted)",fontWeight:850}}>{label.toUpperCase()}</small>
      <strong style={{display:"block",marginTop:12,fontSize:"1.35rem"}}>{value}</strong>
    </article>
  );
}
