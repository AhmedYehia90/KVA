import {useTranslations} from "next-intl";

export function BookingWidget() {
  const t = useTranslations("Home.search");

  return (
    <section className="bookingWrap">
      <div className="container">
        <form className="bookingCard">
          <div className="bookingHeading">
            <span className="eyebrow">{t("eyebrow")}</span>
            <h2>{t("title")}</h2>
          </div>

          <label>
            {t("from")}
            <select defaultValue="HECA" aria-label={t("departureAria")}>
              <option value="HECA">{t("airports.cairo")}</option>
              <option value="HEGN">{t("airports.hurghada")}</option>
              <option value="HELX">{t("airports.luxor")}</option>
            </select>
          </label>

          <label>
            {t("to")}
            <select defaultValue="OMDB" aria-label={t("arrivalAria")}>
              <option value="OMDB">{t("airports.dubai")}</option>
              <option value="OKKK">{t("airports.kuwait")}</option>
              <option value="OEJN">{t("airports.jeddah")}</option>
            </select>
          </label>

          <label>
            {t("aircraft")}
            <select defaultValue="A21N" aria-label={t("aircraftAria")}>
              <option value="A21N">Airbus A321neo</option>
              <option value="E170">Embraer 170</option>
              <option value="B788">Boeing 787-8</option>
            </select>
          </label>

          <button className="button bookingButton" type="button">{t("findFlights")}</button>
        </form>
      </div>
    </section>
  );
}
