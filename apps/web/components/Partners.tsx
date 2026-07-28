import {useTranslations} from "next-intl";

export function Partners() {
  const t = useTranslations("Home.partners");

  return (
    <section className="partners">
      <div className="container partnersInner">
        <div>
          <div className="eyebrow">{t("eyebrow")}</div>
          <h2>{t("title")}</h2>
          <p className="muted">{t("description")}</p>
        </div>

        <div className="partnerMarks" aria-label={t("aria")}>
          <span>IVAO</span><span>VATSIM</span><span>ACARS</span>
        </div>
      </div>
    </section>
  );
}
