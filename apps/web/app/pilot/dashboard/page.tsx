import type { Metadata } from "next";
import Link from "next/link";
import {
  currentPilot,
  formatMinutes,
} from "@/data/pilot";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Pilot Dashboard | Kalabsha Airlines",
  description:
    "Pilot hours, rank progress, aircraft qualifications and recent PIREPs.",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function PilotDashboardPage() {
  const pilot = currentPilot;
  const requiredHours = pilot.nextRankHours - pilot.currentRankMinimumHours;
  const achievedHours = pilot.totalHours - pilot.currentRankMinimumHours;
  const progress = Math.min(
    100,
    Math.max(0, Math.round((achievedHours / requiredHours) * 100)),
  );
  const remainingHours = Math.max(0, pilot.nextRankHours - pilot.totalHours);
  const approvedFlights = pilot.recentFlights.filter(
    (flight) => flight.status === "Approved",
  ).length;

  return (
    <main>
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div>
            <p className="eyebrow">Crew operations</p>
            <h1>Welcome back, Captain.</h1>
            <p className={styles.lead}>
              Track your virtual aviation career, review recent flight reports
              and prepare for your next Kalabsha Airlines assignment.
            </p>
          </div>

          <aside className={styles.identityCard}>
            <span className={styles.avatar} aria-hidden="true">
              {pilot.name
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <span className={styles.callsign}>{pilot.callsign}</span>
              <h2>{pilot.name}</h2>
              <p>{pilot.rank}</p>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.dashboard}>
        <div className="container">
          <div className={styles.statGrid}>
            <article>
              <span>Total flight time</span>
              <strong>{pilot.totalHours}h</strong>
              <small>Verified virtual hours</small>
            </article>
            <article>
              <span>Completed flights</span>
              <strong>{pilot.completedFlights}</strong>
              <small>Across the KVA network</small>
            </article>
            <article>
              <span>Approved reports</span>
              <strong>{approvedFlights}</strong>
              <small>From your latest activity</small>
            </article>
            <article>
              <span>Home base</span>
              <strong className={styles.baseValue}>HECA</strong>
              <small>{pilot.homeBase}</small>
            </article>
          </div>

          <div className={styles.mainGrid}>
            <section className={styles.rankCard}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className="eyebrow">Career progression</p>
                  <h2>{pilot.rank} → {pilot.nextRank}</h2>
                </div>
                <strong>{progress}%</strong>
              </div>

              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-label="Rank progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ width: `${progress}%` }} />
              </div>

              <div className={styles.progressMeta}>
                <span>{pilot.totalHours} logged hours</span>
                <span>{remainingHours} hours remaining</span>
              </div>

              <div className={styles.rankRequirement}>
                <span aria-hidden="true">★</span>
                <div>
                  <strong>Next milestone</strong>
                  <p>
                    Reach {pilot.nextRankHours} total flight hours to qualify
                    for review and promotion to {pilot.nextRank}.
                  </p>
                </div>
              </div>
            </section>

            <aside className={styles.qualificationCard}>
              <p className="eyebrow">Type ratings</p>
              <h2>Aircraft qualifications</h2>
              <div className={styles.qualificationList}>
                {pilot.qualifications.map((aircraft) => (
                  <span key={aircraft}>
                    <i aria-hidden="true">✓</i>
                    {aircraft}
                  </span>
                ))}
              </div>
              <Link href="/fleet">Explore the fleet →</Link>
            </aside>
          </div>

          <section className={styles.activitySection}>
            <div className={styles.sectionHeading}>
              <div>
                <p className="eyebrow">Flight records</p>
                <h2>Recent PIREPs</h2>
              </div>
              <Link className="button outline" href="/pilot/pireps/new">
                File new PIREP
              </Link>
            </div>

            <div className={styles.table}>
              <div className={`${styles.row} ${styles.tableHead}`}>
                <span>Flight</span>
                <span>Route</span>
                <span>Aircraft</span>
                <span>Date</span>
                <span>Duration</span>
                <span>Status</span>
              </div>

              {pilot.recentFlights.map((flight) => (
                <article className={styles.row} key={flight.id}>
                  <strong>{flight.flightNumber}</strong>
                  <span>{flight.route}</span>
                  <span>{flight.aircraft}</span>
                  <span>{formatDate(flight.date)}</span>
                  <span>{formatMinutes(flight.durationMinutes)}</span>
                  <span
                    className={`${styles.status} ${
                      styles[flight.status.toLowerCase()]
                    }`}
                  >
                    {flight.status}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
