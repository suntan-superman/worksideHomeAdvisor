export function HowItWorksSection({ steps = [] }) {
  return (
    <section className="landing-slab">
      <div className="landing-section-header">
        <span className="label">How it works</span>
        <h2>Start fast, get clarity, and move into the real workspace naturally.</h2>
      </div>
      <div className="landing-steps-grid">
        {steps.map((step, index) => (
          <article key={step.title} className="landing-step-card">
            <span className="landing-step-index">{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
