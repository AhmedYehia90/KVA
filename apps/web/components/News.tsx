import {useTranslations} from "next-intl";

const articles = ["roadmap", "fleetStrategy", "community"] as const;

export function News() {
  const t = useTranslations("Home.news");

  return (
    <section className="section sectionAlt">
      <div className="container">
        <div className="eyebrow">{t("eyebrow")}</div>
        <h2>{t("title")}</h2>

        <div className="newsGrid">
          {articles.map((article) => (
            <article className="newsCard" key={article}>
              <span>{t(`articles.${article}.category`)}</span>
              <h3>{t(`articles.${article}.title`)}</h3>
              <p className="muted">{t(`articles.${article}.text`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
