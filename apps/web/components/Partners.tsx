import {localizeUi} from "@/i18n/localize-ui";
import {useLocale as useUiLocale} from "next-intl";
import {useTranslations} from "next-intl";

export function Partners() {
  const uiLocale = useUiLocale();

  const t = useTranslations("Home.partners");

  return localizeUi((
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
  ), uiLocale);
}
