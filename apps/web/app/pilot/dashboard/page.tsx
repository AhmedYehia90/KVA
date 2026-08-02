import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {getLocale, getTranslations} from "next-intl/server";
import {createClient} from "@/lib/supabase/server";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Pilot Dashboard | Kalabsha Airlines",
  description: "Live pilot profile, rank progress and recent PIREPs."
};

type Rank = {
  code: string;
  name: string;
  minimum_hours: number | string;
  minimum_flights: number;
  priority: number;
};

type Profile = {
  id: string;
  callsign: string;
  full_name: string;
  total_hours: number | string;
  total_flights: number;
  ranks: Rank | Rank[] | null;
};

type Airport = {
  icao_code: string;
};

type Pirep = {
  id: string;
  flight_number: string;
  block_minutes: number;
  status: string;
  created_at: string;
  departure: Airport | Airport[] | null;
  arrival: Airport | Airport[] | null;
};

const rankTranslationKeys: Record<string, string> = {
  CADET: "cadet",
  SO: "secondofficer",
  FO: "firstofficer",
  SFO: "seniorfirstofficer",
  CPT: "captain",
  SCPT: "seniorcaptain",
  CP: "chiefpilot"
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function PilotDashboardPage() {
  const t = await getTranslations("PilotDashboard");
  const locale = await getLocale();
  const supabase = await createClient();

  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/pilots/login");
  }

  const {data: profileData, error: profileError} = await supabase
    .from("profiles")
    .select(
      "id, callsign, full_name, total_hours, total_flights, ranks(code, name, minimum_hours, minimum_flights, priority)"
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profileData) {
    throw new Error(
      `Unable to load pilot profile: ${profileError?.message ?? "Profile not found"}`
    );
  }

  const profile = profileData as unknown as Profile;
  const currentRank = first(profile.ranks);
  const totalHours = toNumber(profile.total_hours);
  const totalFlights = profile.total_flights ?? 0;

  const currentPriority = currentRank?.priority ?? 0;
  const currentMinimumHours = toNumber(currentRank?.minimum_hours);

  const {data: nextRankData, error: nextRankError} = await supabase
    .from("ranks")
    .select("code, name, minimum_hours, minimum_flights, priority")
    .gt("priority", currentPriority)
    .order("priority", {ascending: true})
    .limit(1)
    .maybeSingle();

  if (nextRankError) {
    throw new Error(`Unable to load next rank: ${nextRankError.message}`);
  }

  const nextRank = nextRankData as Rank | null;
  const nextMinimumHours = nextRank
    ? toNumber(nextRank.minimum_hours)
    : totalHours;

  const rankHourRange = Math.max(0, nextMinimumHours - currentMinimumHours);
  const hoursCompletedInRank = Math.max(0, totalHours - currentMinimumHours);

  const progress = nextRank
    ? rankHourRange > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((hoursCompletedInRank / rankHourRange) * 100)
          )
        )
      : 0
    : 100;

  const remainingHours = nextRank
    ? Math.max(0, nextMinimumHours - totalHours)
    : 0;

  const {data: pirepData, error: pirepError} = await supabase
    .from("pireps")
    .select(
      `
        id,
        flight_number,
        block_minutes,
        status,
        created_at,
        departure:airports!pireps_departure_airport_id_fkey(icao_code),
        arrival:airports!pireps_arrival_airport_id_fkey(icao_code)
      `
    )
    .eq("pilot_id", user.id)
    .order("created_at", {ascending: false})
    .limit(6);

  if (pirepError) {
    throw new Error(`Unable to load PIREPs: ${pirepError.message}`);
  }

  const recentFlights = (pirepData ?? []) as unknown as Pirep[];
  const approvedReports = recentFlights.filter(
    (flight) => flight.status === "approved"
  ).length;

  const currentRankCode = currentRank?.code ?? "CADET";
  const nextRankCode = nextRank?.code ?? currentRankCode;

  const currentRankLabel = t(
    `ranks.${rankTranslationKeys[currentRankCode] ?? "cadet"}`
  );
  const nextRankLabel = t(
    `ranks.${rankTranslationKeys[nextRankCode] ?? "cadet"}`
  );

  const initials = profile.full_name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date(value));
  }

  function formatDuration(totalMinutes: number) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return t("duration", {
      hours,
      minutes: minutes.toString().padStart(2, "0")
    });
  }

  return (
    <main>
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div>
            <p className="eyebrow">{t("crewOperations")}</p>
            <h1>{t("welcome")}</h1>
            <p className={styles.lead}>{t("intro")}</p>
          </div>

          <aside className={styles.identityCard}>
            <span className={styles.avatar} aria-hidden="true">
              {initials}
            </span>
            <div>
              <span className={styles.callsign}>{profile.callsign}</span>
              <h2>{profile.full_name}</h2>
              <p>{currentRankLabel}</p>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.dashboard}>
        <div className="container">
          <section className={styles.quickActions}>
            <div className={styles.sectionHeading}>
              <div>
                <p className="eyebrow">Pilot Operations</p>
                <h2>Quick Actions</h2>
              </div>
            </div>

            <div className={styles.quickActionsGrid}>
              <Link className={styles.quickAction} href="/pilot/flights">
                <span>Flight Planning</span>
                <strong>Browse Flights →</strong>
              </Link>

              <Link className={styles.quickAction} href="/pilot/pireps/new">
                <span>Flight Records</span>
                <strong>File PIREP →</strong>
              </Link>

              <Link className={styles.quickAction} href="/fleet">
                <span>Operations</span>
                <strong>Explore Fleet →</strong>
              </Link>

              <Link className={styles.quickAction} href="/live-flights">
                <span>Network</span>
                <strong>Live Flights →</strong>
              </Link>
            </div>
          </section>

          <div className={styles.statGrid}>
            <article>
              <span>{t("totalFlightTime")}</span>
              <strong>{t("hoursValue", {hours: totalHours})}</strong>
              <small>{t("verifiedHours")}</small>
            </article>

            <article>
              <span>{t("completedFlights")}</span>
              <strong>{totalFlights}</strong>
              <small>{t("acrossNetwork")}</small>
            </article>

            <article>
              <span>{t("approvedReports")}</span>
              <strong>{approvedReports}</strong>
              <small>{t("latestActivity")}</small>
            </article>

            <article>
              <span>{t("homeBase")}</span>
              <strong className={styles.baseValue}>HECA</strong>
              <small>{t("homeBaseName")}</small>
            </article>
          </div>

          <div className={styles.mainGrid}>
            <section className={styles.rankCard}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className="eyebrow">{t("careerProgression")}</p>
                  <h2>
                    {currentRankLabel}
                    {nextRank ? ` → ${nextRankLabel}` : ""}
                  </h2>
                </div>
                <strong>{progress}%</strong>
              </div>

              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-label={t("rankProgress")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{width: `${progress}%`}} />
              </div>

              <div className={styles.progressMeta}>
                <span>{t("loggedHours", {hours: totalHours})}</span>
                <span>{t("hoursRemaining", {hours: remainingHours})}</span>
              </div>

              {nextRank ? (
                <div className={styles.rankRequirement}>
                  <span aria-hidden="true">★</span>
                  <div>
                    <strong>{t("nextMilestone")}</strong>
                    <p>
                      {t("promotionRequirement", {
                        hours: nextMinimumHours,
                        rank: nextRankLabel
                      })}
                    </p>
                  </div>
                </div>
              ) : null}
            </section>

            <aside className={styles.qualificationCard}>
              <p className="eyebrow">{t("typeRatings")}</p>
              <h2>{t("aircraftQualifications")}</h2>
              <div className={styles.qualificationList}>
                {["E170", "A21N", "A333", "A359", "B788", "B77W", "B748"].map(
                  (aircraft) => (
                    <span key={aircraft}>
                      <i aria-hidden="true">✓</i>
                      {aircraft}
                    </span>
                  )
                )}
              </div>
              <Link href="/fleet">{t("exploreFleet")}</Link>
            </aside>
          </div>

          <section className={styles.activitySection}>
            <div className={styles.sectionHeading}>
              <div>
                <p className="eyebrow">{t("flightRecords")}</p>
                <h2>{t("recentPireps")}</h2>
              </div>

              <Link className="button outline" href="/pilot/pireps/new">
                {t("fileNewPirep")}
              </Link>
            </div>

            <div className={styles.table}>
              <div className={`${styles.row} ${styles.tableHead}`}>
                <span>{t("table.flight")}</span>
                <span>{t("table.route")}</span>
                <span>{t("table.aircraft")}</span>
                <span>{t("table.date")}</span>
                <span>{t("table.duration")}</span>
                <span>{t("table.status")}</span>
              </div>

              {recentFlights.map((flight) => {
                const departure = first(flight.departure)?.icao_code ?? "—";
                const arrival = first(flight.arrival)?.icao_code ?? "—";

                return (
                  <article className={styles.row} key={flight.id}>
                    <strong>{flight.flight_number}</strong>
                    <span>
                      {departure} → {arrival}
                    </span>
                    <span>—</span>
                    <span>{formatDate(flight.created_at)}</span>
                    <span>{formatDuration(flight.block_minutes)}</span>
                    <span
                      className={`${styles.status} ${
                        styles[flight.status.toLowerCase()]
                      }`}
                    >
                      {t(`statuses.${flight.status.toLowerCase()}`)}
                    </span>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
