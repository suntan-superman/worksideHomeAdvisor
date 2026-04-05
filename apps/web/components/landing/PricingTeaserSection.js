import Link from 'next/link';

export function PricingTeaserSection({
  eyebrow = 'Unlock',
  title,
  body,
  bullets = [],
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}) {
  return (
    <section className="landing-slab landing-pricing-teaser">
      <div className="landing-section-header">
        <span className="label">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <ul className="landing-bullet-list">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      <div className="cta-row">
        {primaryHref ? (
          <Link href={primaryHref} className="button-primary">
            {primaryLabel}
          </Link>
        ) : null}
        {secondaryHref ? (
          <Link href={secondaryHref} className="button-secondary">
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
