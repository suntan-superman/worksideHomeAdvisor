import { AppFrame } from '../components/AppFrame';
import { FinalCTASection } from '../components/landing/FinalCTASection';
import { HeroSection } from '../components/landing/HeroSection';
import { RoleChooser } from '../components/landing/RoleChooser';

export default function HomePage() {
  return (
    <AppFrame>
      <HeroSection
        eyebrow="Role chooser"
        title="Choose the right Workside path for the job in front of you."
        subtitle="Workside is a guided selling plan for sellers, agents, and providers. Pick the route that matches your intent and start in the right funnel instead of a generic catch-all page."
        aside={
          <div className="landing-mini-panel landing-mini-panel-tall">
            <span className="label">Core product</span>
            <strong>Guided selling plan + checklist</strong>
            <p>
              Pricing, prep, photos, providers, reports, and flyers all support
              the same outcome: move a property from uncertainty to market-ready.
            </p>
          </div>
        }
      />

      <RoleChooser
        roles={[
          {
            eyebrow: 'Seller funnel',
            title: 'I am selling a home',
            body: 'Get pricing guidance, prep recommendations, provider help, and a clear plan before you list.',
            points: [
              'Address-first preview',
              'Guided prep checklist',
              'Provider help and exports',
            ],
            href: '/sell',
            cta: 'Start seller plan',
            secondaryHref: '/dashboard',
            secondaryCta: 'See dashboard preview',
          },
          {
            eyebrow: 'Agent funnel',
            title: 'I am a real estate agent',
            body: 'Use Workside as a listing acceleration system with seller-facing reports, prep workflow, and property capacity tools.',
            points: [
              'Win listings with better prep',
              'Seller-facing professionalism',
              'Reusable process across properties',
            ],
            href: '/agents',
            cta: 'Get agent access',
            secondaryHref: '/auth?mode=signup&role=agent',
            secondaryCta: 'Create agent account',
          },
          {
            eyebrow: 'Provider funnel',
            title: 'I provide home services',
            body: 'Join the provider network to receive high-intent local seller jobs with verification and profile visibility.',
            points: [
              'Local lead flow',
              'Trust profile + verification',
              'Lead acceptance workflow',
            ],
            href: '/providers',
            cta: 'Join provider network',
            secondaryHref: '/providers/portal',
            secondaryCta: 'Provider portal',
          },
        ]}
      />

      <FinalCTASection
        title="The right funnel should start the experience, not just describe it."
        body="Each path is now dedicated: sellers to /sell, agents to /agents, and providers to /providers. That keeps the promise and the onboarding sequence clear from the first click."
        primaryHref="/sell"
        primaryLabel="Go to seller funnel"
        secondaryHref="/providers"
        secondaryLabel="See provider funnel"
      />
    </AppFrame>
  );
}
