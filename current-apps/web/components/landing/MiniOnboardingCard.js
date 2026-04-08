export function MiniOnboardingCard({
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <section className="landing-slab landing-onboarding-card">
      <div className="landing-section-header">
        <span className="label">Mini onboarding</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="landing-onboarding-body">{children}</div>
      {footer ? <div className="landing-card-footer">{footer}</div> : null}
    </section>
  );
}
