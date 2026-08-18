import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

type Airport = {icao_code: string};
type Pirep = {
  id: string;
  pirep_code: string;
  flight_number: string;
  block_minutes: number;
  landing_rate: number | null;
  status: string;
  created_at: string;
  departure: Airport | Airport[] | null;
  arrival: Airport | Airport[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function PirepsPage({
  searchParams
}: {
  searchParams: Promise<{submitted?: string}>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {data, error} = await supabase
    .from("pireps")
    .select(`
      id,
      pirep_code,
      flight_number,
      block_minutes,
      landing_rate,
      status,
      created_at,
      departure:airports!pireps_departure_airport_id_fkey(icao_code),
      arrival:airports!pireps_arrival_airport_id_fkey(icao_code)
    `)
    .eq("pilot_id", user.id)
    .order("created_at", {ascending:false});

  if (error) throw new Error(`Unable to load PIREPs: ${error.message}`);

  const pireps = (data ?? []) as unknown as Pirep[];

  return (
    <main className="kvaPremiumSubpage">
      <section className="kvaPremiumHero">
        <div className="kvaPremiumHeroInner">
          <div className="kvaPremiumHeroRow">
            <div>
              <p className="eyebrow">Flight Records</p>
              <h1 className="kvaPremiumHeroTitle">My PIREPs</h1>
              <p className="kvaPremiumHeroText">
                Review the flight reports preserved from your completed operations.
              </p>
            </div>
            <Link className="button kvaPremiumHeroSide" href="/pilot/bookings">My Bookings</Link>
          </div>
        </div>
      </section>

      <section className="kvaPremiumSubpageContent">
        <div className="kvaPremiumSubpageBody kvaPremiumSubpageBodyLift">
        {query.submitted ? (
          <div style={{padding:15,marginBottom:20,border:"1px solid rgba(57,220,138,.22)",borderRadius:12,color:"#82edb5",background:"rgba(57,220,138,.08)"}}>
            PIREP submitted successfully.
          </div>
        ) : null}

        <div style={{overflow:"hidden",border:"1px solid var(--border)",borderRadius:18,background:"var(--surface)"}}>
          {pireps.length ? pireps.map((pirep) => {
            const dep = first(pirep.departure)?.icao_code ?? "—";
            const arr = first(pirep.arrival)?.icao_code ?? "—";
            return (
              <article key={pirep.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:18,alignItems:"center",padding:20,borderTop:"1px solid rgba(105,183,231,.13)"}}>
                <strong>{pirep.pirep_code}</strong>
                <span>{pirep.flight_number}</span>
                <span>{dep} → {arr}</span>
                <span>{Math.floor(pirep.block_minutes/60)}h {String(pirep.block_minutes%60).padStart(2,"0")}m</span>
                <span style={{textTransform:"capitalize",color:"#82edb5",fontWeight:800}}>{pirep.status}</span>
              </article>
            );
          }) : (
            <div style={{padding:48,textAlign:"center"}}>
              <h2>No PIREPs yet</h2>
              <p style={{color:"var(--muted)"}}>Complete a flight and submit its report.</p>
            </div>
          )}
        </div>
        </div>
      </section>
    </main>
  );
}
