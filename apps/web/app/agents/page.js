import Link from 'next/link';
import { buildLandingSearchParams } from '@workside/utils';

import { AppFrame } from '../../components/AppFrame';
import { LandingMetaTracker } from '../../components/landing/LandingMetaTracker';

export const metadata = {
  title: 'Agent Access | Workside Home Advisor',
  description: 'Win more listings with seller prep plans, reports, pricing guidance, and marketing outputs.',
};

const AGENT_OUTPUTS = [
  ['Seller Report', 'A polished summary for the homeowner conversation.'],
  ['Marketing Flyer', 'Shareable property marketing without starting from scratch.'],
  ['Agent Dashboard', 'Listings, tasks, reports, and prep status in one place.'],
  ['Seller Workflow', 'A clear path from first meeting to market-ready.'],
];

const AGENT_TRUST = ['Seller-ready reports', 'Photo feedback', 'Prep checklists', 'Marketing outputs'];

export default function AgentLandingPage({ searchParams }) {
  const source =
    typeof searchParams?.src === 'string' ? searchParams.src : 'direct-agent';
  const campaign =
    typeof searchParams?.campaign === 'string' ? searchParams.campaign : '';
  const medium =
    typeof searchParams?.medium === 'string' ? searchParams.medium : '';
  const adset = typeof searchParams?.adset === 'string' ? searchParams.adset : '';
  const ad = typeof searchParams?.ad === 'string' ? searchParams.ad : '';
  const anonymousId =
    typeof searchParams?.anonymousId === 'string' ? searchParams.anonymousId : '';
  const signupHref = `/auth?${buildLandingSearchParams(
    {
      source,
      campaign,
      medium,
      adset,
      ad,
      anonymousId,
      roleIntent: 'agent',
    },
    {
      mode: 'signup',
      role: 'agent',
    },
  ).toString()}`;

  return (
    <AppFrame>
      <LandingMetaTracker
        roleIntent="agent"
        contentName="Agent landing page"
        contentCategory="agent_landing"
        source={source}
        campaign={campaign}
        medium={medium}
        adset={adset}
        ad={ad}
      />

      <section className="marketing-hero marketing-hero-agent">
        <div className="marketing-hero-copy">
          <span className="hero-kicker">For real estate agents</span>
          <h1>Win listings with a better prep plan.</h1>
          <p>
            Give sellers pricing guidance, prep checklists, photo feedback, reports, and marketing
            outputs before the home hits the market.
          </p>
          <div className="cta-row">
            <Link href={signupHref} className="button-primary">
              Start Agent Workspace
            </Link>
            <a className="button-secondary" href="#agent-outputs">
              See Sample Seller Report
            </a>
          </div>
        </div>
        <div className="marketing-hero-visual" aria-label="Workside agent dashboard preview">
          <img src="/marketing/agent-better-prep-plan.png" alt="Workside Home Advisor agent dashboard mockup" />
        </div>
      </section>

      <section id="agent-outputs" className="marketing-output-section">
        <div className="marketing-section-heading">
          <span className="label">Listing tools</span>
          <h2>Show sellers a plan before they choose an agent.</h2>
        </div>
        <div className="marketing-output-grid">
          {AGENT_OUTPUTS.map(([title, body]) => (
            <article key={title} className="marketing-output-card">
              <span className="marketing-output-mark" aria-hidden="true" />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-flow" aria-label="Agent listing prep flow">
        {[
          ['Add a Property', 'Address + seller context'],
          ['Build the Plan', 'Pricing, photos, prep, reports'],
          ['Win the Meeting', 'Clear next steps and polished outputs'],
        ].map(([title, body], index) => (
          <article key={title} className="marketing-flow-step">
            <span className={`marketing-flow-icon marketing-flow-icon-${index + 1}`} aria-hidden="true">
              <span />
            </span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="marketing-trust-row" aria-label="Agent value signals">
        {AGENT_TRUST.map((item) => (
          <div key={item}>
            <span aria-hidden="true" />
            <strong>{item}</strong>
          </div>
        ))}
      </section>

      <section className="marketing-final-band">
        <h2>Start your agent workspace in minutes.</h2>
        <Link href={signupHref} className="button-primary">
          Start Agent Workspace
        </Link>
      </section>
    </AppFrame>
  );
}

