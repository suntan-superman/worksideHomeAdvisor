import Link from 'next/link';

import { AppFrame } from '../../components/AppFrame';
import { FinalCTASection } from '../../components/landing/FinalCTASection';
import { HeroSection } from '../../components/landing/HeroSection';
import { HowItWorksSection } from '../../components/landing/HowItWorksSection';
import { PricingTeaserSection } from '../../components/landing/PricingTeaserSection';
import { TrustSignalSection } from '../../components/landing/TrustSignalSection';
import { ValueCardRow } from '../../components/landing/ValueCardRow';
import { getAgentLandingVariant } from '../../components/landing/copyVariants';

export const metadata = {
  title: 'Agent Access | Workside Home Advisor',
  description: 'Use Workside to win more listings, guide prep faster, and present polished seller-facing reports.',
};

export default function AgentLandingPage({ searchParams }) {
  const source =
    typeof searchParams?.src === 'string' ? searchParams.src : 'direct-agent';
  const campaign =
    typeof searchParams?.campaign === 'string' ? searchParams.campaign : '';
  const medium =
    typeof searchParams?.medium === 'string' ? searchParams.medium : '';
  const copyVariant = getAgentLandingVariant({ source, campaign, medium });

  return (
    <AppFrame>
      <HeroSection
        eyebrow={copyVariant.eyebrow}
        title={copyVariant.title}
        subtitle={copyVariant.subtitle}
        actions={
          <>
            <Link href="/auth?mode=signup&role=agent" className="button-primary">
              {copyVariant.primaryCta}
            </Link>
            <Link href="/dashboard" className="button-secondary">
              {copyVariant.secondaryCta}
            </Link>
          </>
        }
        aside={
          <div className="landing-report-shell">
            <span className="label">Report preview shell</span>
            <h3>Seller-ready presentation</h3>
            <ul className="landing-bullet-list">
              {(copyVariant.themePills || [
                'Pricing strategy summary',
                'Prep plan and provider support',
                'Marketing materials handoff',
              ]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        }
      />

      <ValueCardRow items={copyVariant.valueItems} />

      <HowItWorksSection
        steps={[
          {
            title: 'Open the property workspace',
            body: 'Start a listing with the address, property facts, and pricing context already ready to present.',
          },
          {
            title: 'Guide the seller through prep',
            body: 'Use the workflow rail, checklist, providers, and photo guidance to create momentum quickly.',
          },
          {
            title: 'Ship the polished outputs',
            body: 'Turn the property into seller-facing reports and marketing materials without leaving the system.',
          },
        ]}
      />

      <TrustSignalSection
        eyebrow="Trust"
        title="Help agents look prepared before the listing presentation starts."
        body="The agent funnel should feel like a listing advantage, not a generic SaaS pitch. The credibility comes from showing seller-facing structure, repeatable workflow, and clean outputs."
        items={[
          {
            eyebrow: 'Seller-facing',
            title: 'Reports should look presentation-ready',
            body: 'Agents need pricing and prep outputs they can confidently show to homeowners during live conversations.',
          },
          {
            eyebrow: 'Workflow',
            title: 'Every step should reduce listing friction',
            body: 'Pricing, checklist progress, photos, providers, and materials should feel connected so the agent can move the listing forward without context switching.',
          },
          {
            eyebrow: 'Capacity',
            title: 'Billing should map to active listing volume',
            body: 'The product is more believable when the subscription model reflects how agents actually manage multiple properties at once.',
          },
        ]}
      />

      <PricingTeaserSection
        eyebrow="Agent billing"
        title="Professional value, framed around active property capacity."
        body="Agent plans should feel like listing acceleration tools, not generic software subscriptions."
        bullets={[
          'Active property limits that map to the real listing pipeline.',
          'Seller-facing outputs that justify the subscription quickly.',
          'Clear route into the existing property dashboard and workspace.',
        ]}
        primaryHref="/auth?mode=signup&role=agent"
        primaryLabel="Create agent account"
        secondaryHref="/dashboard"
        secondaryLabel="View dashboard preview"
      />

      <FinalCTASection
        title={copyVariant.finalTitle}
        body={copyVariant.finalBody}
        primaryHref="/auth?mode=signup&role=agent"
        primaryLabel={copyVariant.primaryCta}
        secondaryHref="/sell"
        secondaryLabel="See seller funnel"
      />
    </AppFrame>
  );
}
