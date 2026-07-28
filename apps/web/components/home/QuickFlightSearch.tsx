export function QuickFlightSearch() {
  return (
    <section className="booking-section">
      <div className="container booking-layout">
        <div className="booking-panel">
          <div className="booking-heading">
            <div>
              <p className="section-eyebrow">Plan your journey</p>
              <h2>Quick Flight Search</h2>
            </div>
            <span className="booking-badge">KVA Booking</span>
          </div>

          <form className="flight-search-form">
            <label>
              <span>From</span>
              <select defaultValue="">
                <option value="" disabled>Select departure</option>
                <option value="HECA">Cairo — HECA</option>
                <option value="OMDB">Dubai — OMDB</option>
                <option value="OERK">Riyadh — OERK</option>
              </select>
            </label>

            <label>
              <span>To</span>
              <select defaultValue="">
                <option value="" disabled>Select destination</option>
                <option value="OMDB">Dubai — OMDB</option>
                <option value="LTFM">Istanbul — LTFM</option>
                <option value="EGLL">London — EGLL</option>
              </select>
            </label>

            <label>
              <span>Departure</span>
              <input type="date" />
            </label>

            <label>
              <span>Passengers</span>
              <select defaultValue="1">
                <option value="1">1 Passenger</option>
                <option value="2">2 Passengers</option>
                <option value="3">3 Passengers</option>
                <option value="4">4 Passengers</option>
              </select>
            </label>

            <button type="submit" className="search-button">
              Search Flights
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
