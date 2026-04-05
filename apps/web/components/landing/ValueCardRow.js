export function ValueCardRow({ items = [] }) {
  return (
    <section className="landing-value-grid">
      {items.map((item) => (
        <article key={item.title} className="landing-value-card">
          <span className="label">{item.eyebrow}</span>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </article>
      ))}
    </section>
  );
}
