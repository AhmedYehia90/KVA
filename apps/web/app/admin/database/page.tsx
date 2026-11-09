import {localizeUi} from "@/i18n/localize-ui";
import {getLocale as getUiLocale} from "next-intl/server";
import {getFleetTypes} from "@/lib/data/fleet";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";

export default async function DatabaseOverviewPage() {
  const uiLocale = await getUiLocale();

  await requireOperationsConsoleAdmin();
  const fleetTypes = await getFleetTypes();

  return localizeUi((
    <main className="section">
      <div className="container">
        <div className="eyebrow">KVA v3.1</div>
        <h1>Database Overview</h1>

        <div className="stats">
          <article className="stat">
            <strong>{fleetTypes.length}</strong>
            <span>Fleet types</span>
          </article>
        </div>

        <div className="fleetGrid">
          {fleetTypes.map((item) => (
            <article className="fleetCard" key={item.id}>
              <div className="fleetCode">{item.icao_code}</div>
              <h3>{item.manufacturer} {item.model}</h3>
              <p className="muted">
                Range: {item.range_nm ?? "—"} NM · Cruise: {item.cruise_speed_kts ?? "—"} kt
              </p>
            </article>
          ))}
        </div>
      </div>
    </main>
  ), uiLocale);
}
