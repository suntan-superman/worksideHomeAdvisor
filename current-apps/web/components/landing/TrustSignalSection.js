export function TrustSignalSection({
  eyebrow = 'Trust',
  title,
  body,
  items = [],
}) {
  return (
    <section className="landing-slab landing-trust-section">
      <div className="landing-section-header">
        <span className="label">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <div className="landing-trust-grid">
        {items.map((item) => (
          <article key={item.title} className="landing-trust-card">
            <span className="label">{item.eyebrow}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
