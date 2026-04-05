export function HeroSection({
  eyebrow,
  title,
  subtitle,
  actions,
  aside,
}) {
  return (
    <section className="landing-hero-grid">
      <div className="landing-hero-copy">
        {eyebrow ? <span className="hero-kicker">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {actions ? <div className="cta-row">{actions}</div> : null}
      </div>
      {aside ? <div className="landing-hero-panel">{aside}</div> : null}
    </section>
  );
}
