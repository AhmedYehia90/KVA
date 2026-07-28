import {useTranslations} from "next-intl";

const flights = [
  {flight: "KVA201", route: "HECA → OMDB", aircraft: "A21N", status: "boarding"},
  {flight: "KVA315", route: "HECA → OKKK", aircraft: "E170", status: "enRoute"},
  {flight: "KVA707", route: "HECA → OEJN", aircraft: "B77W", status: "scheduled"}
] as const;

export function LiveFlights() {
  const t = useTranslations("Home.liveFlights");

  return (
    <section className="section">
      <div className="container">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">{t("eyebrow")}</div>
            <h2>{t("title")}</h2>
          </div>
          <span className="liveBadge"><i />{t("networkActive")}</span>
        </div>

        <div className="flightTable" role="table" aria-label={t("aria")}>
          <div className="flightRow flightHead" role="row">
            <span>{t("flight")}</span><span>{t("route")}</span>
            <span>{t("aircraft")}</span><span>{t("status")}</span>
          </div>

          {flights.map((flight) => (
            <div className="flightRow" role="row" key={flight.flight}>
              <strong>{flight.flight}</strong>
              <span>{flight.route}</span>
              <span>{flight.aircraft}</span>
              <span className="status">{t(`statuses.${flight.status}`)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
