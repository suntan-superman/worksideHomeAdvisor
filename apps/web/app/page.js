import Link from 'next/link';

import { BRANDING } from '@workside/branding';

import { AppFrame } from '../components/AppFrame';

const features = [
  {
    title: 'Pricing guidance that explains itself',
    body: 'See strong comps, likely list-price bands, confidence, and what would move the needle before launch.',
  },
  {
    title: 'Room-by-room prep advice',
    body: 'Get paint, staging, decluttering, and repair recommendations ranked by likely payoff.',
  },
  {
    title: 'Marketing and flyer generation',
    body: 'Turn homeowner photos into listing copy, standout feature callouts, and branded flyer drafts.',
  },
];

export default function HomePage() {
  return (
    <AppFrame>
      <section className="hero-grid">
        <div className="hero-copy">
          <div className="hero-kicker">{BRANDING.tagline}</div>
          <h1>Sell with a plan, not a pile of guesses.</h1>
          <p>
            Workside Home Seller Assistant helps owners price their home, choose
            the best prep work, surface the right features, and ship polished
            marketing materials with AI support and clear disclaimers.
          </p>

          <div className="cta-row">
            <Link href="/auth" className="button-primary">
              Start seller onboarding
            </Link>
            <Link href="/providers/join" className="button-secondary">
              List your business
            </Link>
            <Link href="/providers/portal" className="button-secondary">
              Provider portal
            </Link>
            <Link href="/dashboard" className="button-secondary">
              View dashboard preview
            </Link>
          </div>

          <div className="mini-stats">
            <div className="stat-card">
              <strong>Pricing</strong>
              <span>Comps, scenarios, and confidence ranges</span>
            </div>
            <div className="stat-card">
              <strong>Prep</strong>
              <span>High-ROI improvements and paint guidance</span>
            </div>
            <div className="stat-card">
              <strong>Marketing</strong>
              <span>Photo ranking, flyer drafts, and listing copy</span>
            </div>
          </div>
        </div>

        <div className="hero-panel">
          <div className="panel-window">
            <div className="panel-header">
              <div>
                <span className="label">Property workspace</span>
                <h2>1234 Ridgeview Lane</h2>
              </div>
              <span className="pill">Listing ready: 78%</span>
            </div>

            <div className="metric-grid">
              <article className="metric-card">
                <span className="label">Suggested list band</span>
                <strong>$624k to $649k</strong>
                <p>Supported by nearby sales, size alignment, and current buyer demand.</p>
              </article>
              <article className="metric-card">
                <span className="label">Top prep recommendation</span>
                <strong>Repaint the living room and primary bedroom in a warm neutral.</strong>
                <p>Best bang for the buck for photo quality and buyer appeal.</p>
              </article>
              <article className="metric-card span-two">
                <span className="label">Best features to highlight</span>
                <div className="tag-row">
                  <span>Updated kitchen</span>
                  <span>Large backyard</span>
                  <span>Natural light</span>
                  <span>Corner lot</span>
                  <span>Move-in-ready feel</span>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="section-grid">
        {features.map((feature) => (
          <article key={feature.title} className="feature-card">
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>
    </AppFrame>
  );
}
