import {useTranslations} from "next-intl";

const destinations = [
  {city: "dubai", airport: "OMDB", region: "uae"},
  {city: "kuwait", airport: "OKKK", region: "kuwait"},
  {city: "jeddah", airport: "OEJN", region: "saudi"},
  {city: "istanbul", airport: "LTFM", region: "turkiye"}
] as const;

export function Destinations() {
  const t = useTranslations("Home.destinations");

  return (
    <section className="section sectionAlt">
      <div className="container">
        <div className="eyebrow">{t("eyebrow")}</div>
        <h2>{t("title")}</h2>

        <div className="destinationGrid">
          {destinations.map((destination, index) => (
            <article className={`destinationCard destination${index + 1}`} key={destination.airport}>
              <div>
                <span>{destination.airport}</span>
                <h3>{t(`cities.${destination.city}`)}</h3>
                <p>{t(`regions.${destination.region}`)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
