import Link from "next/link";
import {useTranslations} from "next-intl";

export function Hero() {
  const t = useTranslations("Home.hero");

  return (
    <section className="hero">
      <div className="container heroGrid">
        <div className="heroContent">
          <div className="eyebrow">{t("eyebrow")}</div>
          <h1>{t("titleLine1")}<br />{t("titleLine2")}</h1>
          <p>{t("description")}</p>

          <div className="actions">
            <Link className="button" href="/pilots">{t("joinPilot")}</Link>
            <Link className="button outline" href="/fleet">{t("exploreFleet")}</Link>
          </div>
        </div>

        <div className="heroAircraft" aria-label={t("aircraftAria")}>
          <div className="aircraftGlow" />
          <span aria-hidden="true">✈</span>
          <small>{t("artworkPlaceholder")}</small>
        </div>
      </div>
    </section>
  );
}
