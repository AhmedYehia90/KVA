import Link from "next/link";
import {useTranslations} from "next-intl";

const fleet = [
  {code: "E170", name: "Embraer 170", role: "regional"},
  {code: "A21N", name: "Airbus A321neo", role: "mediumHaul"},
  {code: "B77W", name: "Boeing 777-300ER", role: "longHaul"}
] as const;

export function FleetPreview() {
  const t = useTranslations("Home.fleet");

  return (
    <section className="section">
      <div className="container">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">{t("eyebrow")}</div>
            <h2>{t("title")}</h2>
          </div>
          <Link className="textLink" href="/fleet">{t("viewAll")}</Link>
        </div>

        <div className="fleetGrid">
          {fleet.map((aircraft) => (
            <article className="fleetCard" key={aircraft.code}>
              <div className="fleetVisual" aria-hidden="true">✈</div>
              <div className="fleetCode">{aircraft.code}</div>
              <h3>{aircraft.name}</h3>
              <p className="muted">{t(`roles.${aircraft.role}`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
