const articles = [
  {
    date: "Operations",
    title: "Kalabsha Airlines development roadmap",
    text: "The platform is being prepared for pilot accounts, schedules, ACARS and live operational data.",
  },
  {
    date: "Fleet",
    title: "A flexible fleet strategy",
    text: "The planned fleet supports regional, medium-haul and long-haul virtual operations.",
  },
  {
    date: "Community",
    title: "Built around virtual pilots",
    text: "Training, events and realistic procedures will form the heart of the Kalabsha community.",
  },
] as const;

export function News() {
  return (
    <section className="section sectionAlt">
      <div className="container">
        <div className="eyebrow">Latest updates</div>
        <h2>From Kalabsha Airlines</h2>

        <div className="newsGrid">
          {articles.map((article) => (
            <article className="newsCard" key={article.title}>
              <span>{article.date}</span>
              <h3>{article.title}</h3>
              <p className="muted">{article.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
