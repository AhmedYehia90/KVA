import {useTranslations} from "next-intl";

const stats = [
  {value: "17", key: "aircraft"},
  {value: "6", key: "fleetTypes"},
  {value: "45+", key: "destinations"},
  {value: "24/7", key: "operations"}
] as const;

export function Stats() {
  const t = useTranslations("Home.stats");

  return (
    <section className="container stats" aria-label={t("aria")}>
      {stats.map((stat) => (
        <article className="stat" key={stat.key}>
          <strong>{stat.value}</strong>
          <span>{t(stat.key)}</span>
        </article>
      ))}
    </section>
  );
}
