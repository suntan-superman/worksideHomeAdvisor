import Link from 'next/link';

import { AppFrame } from '../../components/AppFrame';
import { FinalCTASection } from '../../components/landing/FinalCTASection';
import { HeroSection } from '../../components/landing/HeroSection';
import { HowItWorksSection } from '../../components/landing/HowItWorksSection';
import { PricingTeaserSection } from '../../components/landing/PricingTeaserSection';
import { ProviderLandingClient } from '../../components/landing/ProviderLandingClient';
import { TrustSignalSection } from '../../components/landing/TrustSignalSection';
import { ValueCardRow } from '../../components/landing/ValueCardRow';
import { getProviderLandingVariant } from '../../components/landing/copyVariants';

export const metadata = {
  title: 'Join Provider Network | Workside Home Advisor',
  description: 'Get high-intent seller jobs delivered to you through the Workside provider network.',
};

export default function ProviderLandingPage({ searchParams }) {
  const source =
    typeof searchParams?.src === 'string' ? searchParams.src : 'direct-provider';
  const campaign =
    typeof searchParams?.campaign === 'string' ? searchParams.campaign : '';
  const medium =
    typeof searchParams?.medium === 'string' ? searchParams.medium : '';
  const copyVariant = getProviderLandingVariant({ source, campaign, medium });

  return (
    <AppFrame>
      <HeroSection
        eyebrow={copyVariant.eyebrow}
        title={copyVariant.title}
        subtitle={copyVariant.subtitle}
        actions={
          <>
            <Link href="/providers/join" className="button-primary">
              {copyVariant.primaryCta}
            </Link>
            <Link href="/providers/portal" className="button-secondary">
              {copyVariant.secondaryCta}
            </Link>
          </>
        }
        aside={<ProviderLandingClient source={source} />}
      />

      <ValueCardRow items={copyVariant.valueItems} />

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
        title={copyVariant.finalTitle}
        body={copyVariant.finalBody}
        primaryHref="/providers/join"
        primaryLabel={copyVariant.primaryCta}
        secondaryHref="/sell"
        secondaryLabel="See seller funnel"
      />
    </AppFrame>
  );
}
