import Link from 'next/link';

import { AppFrame } from '../../components/AppFrame';
import { FinalCTASection } from '../../components/landing/FinalCTASection';
import { HeroSection } from '../../components/landing/HeroSection';
import { HowItWorksSection } from '../../components/landing/HowItWorksSection';
import { PricingTeaserSection } from '../../components/landing/PricingTeaserSection';
import { ProviderLandingClient } from '../../components/landing/ProviderLandingClient';
import { TrustSignalSection } from '../../components/landing/TrustSignalSection';
import { ValueCardRow } from '../../components/landing/ValueCardRow';

export const metadata = {
  title: 'Join Provider Network | Workside Home Advisor',
  description: 'Get high-intent seller jobs delivered to you through the Workside provider network.',
};

export default function ProviderLandingPage({ searchParams }) {
  const source =
    typeof searchParams?.src === 'string' ? searchParams.src : 'direct-provider';

  return (
    <AppFrame>
      <HeroSection
        eyebrow="Provider funnel"
        title="Get high-intent seller jobs delivered to you."
        subtitle="Join the Workside provider network and receive local service requests from homeowners and agents preparing homes for market."
        actions={
          <>
            <Link href="/providers/join" className="button-primary">
              Start provider signup
            </Link>
            <Link href="/providers/portal" className="button-secondary">
              Open provider portal
            </Link>
          </>
        }
        aside={<ProviderLandingClient source={source} />}
      />

      <ValueCardRow
        items={[
          {
            eyebrow: 'Demand',
            title: 'Qualified local work',
            body: 'Providers appear when a seller workflow actually needs help, not as random cold directory traffic.',
          },
          {
            eyebrow: 'Trust',
            title: 'Trust badges and verification',
            body: 'Self-reported and verified signals help providers build confidence in the marketplace.',
          },
          {
            eyebrow: 'Workflow',
            title: 'Simple lead acceptance flow',
            body: 'Join, verify, appear in the marketplace, then manage requests from the portal instead of scattered email threads.',
          },
        ]}
      />

      <HowItWorksSection
        steps={[
          {
            title: 'Pick your service area',
            body: 'Tell Workside which category you serve and where you can actually take work.',
          },
          {
            title: 'Complete trust and verification details',
            body: 'Profiles can include licensing, insurance, bonding, and supporting documents when needed.',
          },
          {
            title: 'Receive seller-facing requests',
            body: 'Leads arrive in the provider portal where you can review, accept, or decline them cleanly.',
          },
        ]}
      />

      <TrustSignalSection
        eyebrow="Trust"
        title="Providers should understand why these leads are worth answering."
        body="The provider funnel works best when it looks like a real marketplace channel: clear category targeting, clear service area setup, and visible trust expectations before billing pressure appears."
        items={[
          {
            eyebrow: 'Lead quality',
            title: 'Seller requests come from active prep workflow',
            body: 'The value proposition is stronger than a generic directory because providers appear when the property workflow actually needs that service.',
          },
          {
            eyebrow: 'Verification',
            title: 'Trust signals are part of the profile itself',
            body: 'Licensing, insurance, bonding, and verification context should improve placement and help sellers understand who they are contacting.',
          },
          {
            eyebrow: 'Visibility',
            title: 'Premium placement belongs after value is visible',
            body: 'Free listing first and paid visibility later makes the marketplace feel more credible and easier to adopt.',
          },
        ]}
      />

      <PricingTeaserSection
        eyebrow="Visibility"
        title="Free listing first, premium visibility when the profile is ready."
        body="The provider funnel should feel like a real growth channel: join first, verify the profile, then upgrade for more placement when the value is obvious."
        bullets={[
          'Qualified local demand instead of broad unfiltered traffic.',
          'Verification raises trust and ranking quality.',
          'Premium placement belongs after the provider sees the opportunity clearly.',
        ]}
        primaryHref="/providers/join"
        primaryLabel="Join provider network"
        secondaryHref="/providers/portal"
        secondaryLabel="Open provider portal"
      />

      <FinalCTASection
        title="Join the network before the next seller request is routed."
        body="Set the category, ZIP, and service radius now, then continue into the provider signup and billing flow from there."
        primaryHref="/providers/join"
        primaryLabel="Start provider signup"
        secondaryHref="/sell"
        secondaryLabel="See seller funnel"
      />
    </AppFrame>
  );
}
