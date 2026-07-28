export function BookingWidget() {
  return (
    <section className="bookingWrap">
      <div className="container">
        <form className="bookingCard">
          <div className="bookingHeading">
            <span className="eyebrow">Quick flight search</span>
            <h2>Plan your next operation</h2>
          </div>

          <label>
            From
            <select defaultValue="HECA" aria-label="Departure airport">
              <option value="HECA">Cairo — HECA</option>
              <option value="HEGN">Hurghada — HEGN</option>
              <option value="HELX">Luxor — HELX</option>
            </select>
          </label>

          <label>
            To
            <select defaultValue="OMDB" aria-label="Arrival airport">
              <option value="OMDB">Dubai — OMDB</option>
              <option value="OKKK">Kuwait — OKKK</option>
              <option value="OEJN">Jeddah — OEJN</option>
            </select>
          </label>

          <label>
            Aircraft
            <select defaultValue="A320" aria-label="Aircraft type">
              <option value="A320">Airbus A320</option>
              <option value="B738">Boeing 737-800</option>
              <option value="B77W">Boeing 777-300ER</option>
            </select>
          </label>

          <button className="button bookingButton" type="button">
            Find Flights
          </button>
        </form>
      </div>
    </section>
  );
}
