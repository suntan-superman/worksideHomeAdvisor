import Link from 'next/link';

export function FinalCTASection({
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}) {
  return (
    <section className="landing-final-cta">
      <div>
        <span className="label">Final CTA</span>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <div className="cta-row">
        <Link href={primaryHref} className="button-primary">
          {primaryLabel}
        </Link>
        {secondaryHref ? (
          <Link href={secondaryHref} className="button-secondary">
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
