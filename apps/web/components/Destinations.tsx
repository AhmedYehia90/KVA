const destinations = [
  { city: "Dubai", airport: "OMDB", region: "United Arab Emirates" },
  { city: "Kuwait", airport: "OKKK", region: "Kuwait" },
  { city: "Jeddah", airport: "OEJN", region: "Saudi Arabia" },
  { city: "Istanbul", airport: "LTFM", region: "Türkiye" },
] as const;

export function Destinations() {
  return (
    <section className="section sectionAlt">
      <div className="container">
        <div className="eyebrow">Popular destinations</div>
        <h2>Connect Egypt to the region</h2>

        <div className="destinationGrid">
          {destinations.map((destination, index) => (
            <article className={`destinationCard destination${index + 1}`} key={destination.airport}>
              <div>
                <span>{destination.airport}</span>
                <h3>{destination.city}</h3>
                <p>{destination.region}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
