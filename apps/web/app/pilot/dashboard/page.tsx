import type {Metadata} from "next";
import Link from "next/link";
import {getLocale, getTranslations} from "next-intl/server";
import {currentPilot} from "@/data/pilot";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Pilot Dashboard | Kalabsha Airlines",
  description:
    "Pilot hours, rank progress, aircraft qualifications and recent PIREPs."
};

function rankKey(rank: string) {
  return rank.toLowerCase().replaceAll(" ", "");
}

function statusKey(status: string) {
  return status.toLowerCase();
}

export default async function PilotDashboardPage() {
  const t = await getTranslations("PilotDashboard");
  const locale = await getLocale();
  const pilot = currentPilot;

  const requiredHours = pilot.nextRankHours - pilot.currentRankMinimumHours;
  const achievedHours = pilot.totalHours - pilot.currentRankMinimumHours;
  const progress = Math.min(
    100,
    Math.max(0, Math.round((achievedHours / requiredHours) * 100))
  );
  const remainingHours = Math.max(0, pilot.nextRankHours - pilot.totalHours);
  const approvedFlights = pilot.recentFlights.filter(
    (flight) => flight.status === "Approved"
  ).length;

  const currentRank = t(`ranks.${rankKey(pilot.rank)}`);
  const nextRank = t(`ranks.${rankKey(pilot.nextRank)}`);

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
              {pilot.name
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <span className={styles.callsign}>{pilot.callsign}</span>
              <h2>{pilot.name}</h2>
              <p>{currentRank}</p>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.dashboard}>
        <div className="container">
          <div className={styles.statGrid}>
            <article>
              <span>{t("totalFlightTime")}</span>
              <strong>{t("hoursValue", {hours: pilot.totalHours})}</strong>
              <small>{t("verifiedHours")}</small>
            </article>
            <article>
              <span>{t("completedFlights")}</span>
              <strong>{pilot.completedFlights}</strong>
              <small>{t("acrossNetwork")}</small>
            </article>
            <article>
              <span>{t("approvedReports")}</span>
              <strong>{approvedFlights}</strong>
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
                  <h2>{currentRank} → {nextRank}</h2>
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
                <span>{t("loggedHours", {hours: pilot.totalHours})}</span>
                <span>{t("hoursRemaining", {hours: remainingHours})}</span>
              </div>

              <div className={styles.rankRequirement}>
                <span aria-hidden="true">★</span>
                <div>
                  <strong>{t("nextMilestone")}</strong>
                  <p>
                    {t("promotionRequirement", {
                      hours: pilot.nextRankHours,
                      rank: nextRank
                    })}
                  </p>
                </div>
              </div>
            </section>

            <aside className={styles.qualificationCard}>
              <p className="eyebrow">{t("typeRatings")}</p>
              <h2>{t("aircraftQualifications")}</h2>
              <div className={styles.qualificationList}>
                {pilot.qualifications.map((aircraft) => (
                  <span key={aircraft}>
                    <i aria-hidden="true">✓</i>
                    {aircraft}
                  </span>
                ))}
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

              {pilot.recentFlights.map((flight) => (
                <article className={styles.row} key={flight.id}>
                  <strong>{flight.flightNumber}</strong>
                  <span>{flight.route}</span>
                  <span>{flight.aircraft}</span>
                  <span>{formatDate(flight.date)}</span>
                  <span>{formatDuration(flight.durationMinutes)}</span>
                  <span
                    className={`${styles.status} ${
                      styles[flight.status.toLowerCase()]
                    }`}
                  >
                    {t(`statuses.${statusKey(flight.status)}`)}
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
