// KVA_PILOT_OFFICE_V91_REAL_UI_REBUILD
import styles from "./page.module.css";

const statCards = [
  { icon: "✈", label: "Next Flight", value: "ASW → RUH", detail: "Aswan Intl → Riyadh Intl", meta: "18 MAY 2026 · 18:30 UTC" },
  { icon: "▣", label: "Career Progress", value: "Captain", detail: "2650 / 4000 XP", progress: 71 },
  { icon: "◈", label: "KVA Credits", value: "350 KVC", detail: "Wallet Balance" },
  { icon: "◷", label: "Flight Hours", value: "18.9", detail: "Total on KVA OS" },
  { icon: "♜", label: "Achievements", value: "24", detail: "Badges Earned" },
  { icon: "✦", label: "Mentor AI", value: "Good Evening", detail: "Ready to assist you" },
] as const;

function RouteMap() {
  return (
    <div className={styles.routeMap} aria-label="Route map from Aswan to Riyadh">
      <span className={`${styles.routeDot} ${styles.dotOne}`} />
      <span className={`${styles.routeDot} ${styles.dotTwo}`} />
      <span className={`${styles.routeDot} ${styles.dotThree}`} />
      <span className={`${styles.routeDot} ${styles.dotFour}`} />
      <span className={styles.routeLine} />
      <span className={styles.routePlane}>✈</span>
    </div>
  );
}

function Monitor({ kind }: { kind: "route" | "flight" | "weather" }) {
  return (
    <article className={`${styles.monitor} ${styles[kind]}`}>
      <div className={styles.monitorScreen}>
        {kind === "route" && (
          <>
            <p className={styles.eyebrow}>ROUTE MAP</p>
            <RouteMap />
            <div className={styles.routeFooter}><span><b>ASW</b><small>Aswan Intl</small></span><i>✈</i><span><b>RUH</b><small>Riyadh Intl</small></span></div>
          </>
        )}
        {kind === "flight" && (
          <>
            <p className={styles.eyebrow}>FLIGHT PLAN</p>
            <h2>ASW → RUH</h2>
            <strong className={styles.ready}>READY FOR DISPATCH</strong>
            <div className={styles.flightFacts}>
              <span><small>DISTANCE</small><b>1,362 NM</b></span>
              <span><small>FLIGHT TIME</small><b>02:45</b></span>
              <span><small>CRZ ALT</small><b>FL340</b></span>
              <span><small>STD / OFF</small><b>18:30 UTC</b></span>
            </div>
            <div className={styles.aircraftGlyph}><i /><b>✈</b><i /></div>
            <p className={styles.aircraftType}>B777-300ER</p>
          </>
        )}
        {kind === "weather" && (
          <>
            <p className={styles.eyebrow}>WEATHER OVERVIEW</p>
            <div className={styles.weatherMain}>
              <span className={styles.cloud}>☾<i>☁</i></span>
              <span><small>ASW · Aswan Intl</small><b>27°C</b><em>Few Clouds</em></span>
              <dl><div><dt>WIND</dt><dd>120° 12 KT</dd></div><div><dt>VISIBILITY</dt><dd>10 KM</dd></div><div><dt>QNH</dt><dd>1013 hPa</dd></div></dl>
            </div>
            <div className={styles.notams}><b>NOTAMS</b><span>No active NOTAMs</span></div>
          </>
        )}
      </div>
      <div className={styles.monitorStem} />
      <div className={styles.monitorBase} />
    </article>
  );
}

export default function PilotOfficePage() {
  return (
    <main className={styles.page} data-kva-pilot-office-v9-1>
      <section className={styles.office} aria-labelledby="pilot-office-title">
        <div className={styles.ceiling}><span /><span /><span /></div>
        <div className={styles.brandWall}>
          <div><h1 id="pilot-office-title">PILOT OFFICE</h1><p>Your personal command center</p></div>
          <div className={styles.wingMark}><i /><i /><i /></div>
          <strong>Kalabsha Airlines</strong><span className={styles.brandRule}>PILOT OFFICE</span>
        </div>
        <div className={styles.shelf} aria-hidden="true"><span /><span /><span /><i /><b /></div>

        <div className={styles.window} aria-label="Night airport view">
          <div className={styles.sky}><span className={styles.mountains} /></div>
          <div className={styles.terminal}><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <div className={styles.runway}><span /><span /><span /><span /><span /><span /><span /></div>
          <div className={styles.tower}><i /><b /><span /></div>
          <div className={styles.aircraftTail}><i /><b>✦</b></div>
          <div className={styles.windowFrames}><i /><i /><i /></div>
        </div>

        <div className={styles.desk}>
          <div className={styles.deskEdge} />
          <div className={styles.monitorBank}><Monitor kind="route" /><Monitor kind="flight" /><Monitor kind="weather" /></div>
          <div className={styles.tablet}><small>UNIVERSAL</small><b>PILOT PASSPORT</b><div><span>KVA-P001</span><strong>kanzy90</strong><em>Chief Pilot</em></div><i>▦</i></div>
          <div className={styles.keyboard}>{Array.from({ length: 42 }, (_, index) => <i key={index} />)}</div>
          <div className={styles.mouse} />
          <div className={styles.headphones}><i /><span /><b /></div>
          <div className={styles.mug}><span>✦</span><i /></div>
          <div className={styles.logbook}><span>✦</span><b>KVA OS</b><small>FLIGHT LOGBOOK</small></div>
          <div className={styles.pens}><i /><i /></div>
          <div className={styles.clipboard}><span /><b>FLIGHT BRIEFING</b>{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</div>
          <div className={styles.deskPhone}><i /><b /><span /></div>
          <div className={styles.lamp}><i /><b /><span /></div>
        </div>

        <div className={styles.chair} aria-hidden="true"><span /><i /><b /></div>
      </section>

      <section className={styles.stats} aria-label="Pilot overview">
        {statCards.map((card) => (
          <article className={styles.statCard} key={card.label}>
            <span className={styles.statIcon}>{card.icon}</span>
            <small>{card.label}</small><strong>{card.value}</strong><p>{card.detail}</p>
            {"meta" in card && <em>{card.meta}</em>}
            {"progress" in card && <div className={styles.progress}><i style={{ width: `${card.progress}%` }} /><span>{card.progress}%</span></div>}
          </article>
        ))}
      </section>
    </main>
  );
}
