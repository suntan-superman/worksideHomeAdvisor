import { AppFrame } from '../../components/AppFrame';

const sections = [
  {
    title: '1. Eligibility and Accounts',
    body: 'You must be legally capable of entering into a binding agreement to use the service. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.',
  },
  {
    title: '2. Description of the Service',
    body: 'Workside Home Advisor may include features such as pricing guidance, comparable property analysis, AI-generated recommendations, property photo analysis, listing materials, checklists, provider directories, and marketing content tools. Features may change over time.',
  },
  {
    title: '3. No Professional Advice',
    paragraphs: [
      'The service is provided for informational and workflow-support purposes only. Any pricing guidance, improvement suggestions, provider listings, document drafts, or AI-generated outputs are not legal, tax, financial, appraisal, brokerage, inspection, engineering, contractor, or other professional advice.',
      'You are solely responsible for verifying all information and for consulting licensed professionals where appropriate, including attorneys, real estate brokers, inspectors, title companies, tax professionals, contractors, and other advisors.',
    ],
  },
  {
    title: '4. AI-Generated Content and Estimates',
    body: 'The service may generate content using automated systems and artificial intelligence. AI-generated outputs may contain errors, omissions, outdated information, or unsuitable recommendations. You must independently review and validate any AI-generated content before relying on it.',
    items: [
      'Pricing ranges are estimates only and are not appraisals.',
      'Visualizations are conceptual previews only and are not guarantees of actual remodel results.',
      'Marketing copy, flyers, and drafts must be reviewed before use.',
    ],
  },
  {
    title: '5. Property, Photo, and Content Uploads',
    paragraphs: [
      'You represent that you have the rights necessary to upload and use any content you submit, including property photos, descriptions, logos, and other materials. You grant Workside a non-exclusive license to host, process, display, analyze, and use submitted content as necessary to operate and improve the service.',
      'You must not upload content that infringes another party’s rights, violates law, contains malware, or is otherwise harmful.',
    ],
  },
  {
    title: '6. Provider Listings and Marketplace Content',
    body: 'The service may display third-party providers such as title companies, inspectors, attorneys, photographers, contractors, or other service providers. Workside does not endorse, guarantee, or warrant any listed provider unless expressly stated otherwise. Sponsored placements may appear in the service and will be labeled as such where applicable.',
  },
  {
    title: '7. SMS Communications',
    body: 'By opting in where required, users and providers agree to receive transactional SMS messages related to account activity, account verification, service requests, provider marketplace interactions, and workflow updates. Message frequency varies. Reply STOP to opt out or HELP for assistance.',
  },
  {
    title: '8. Acceptable Use',
    body: 'You agree not to use the service for unlawful, fraudulent, or misleading purposes, interfere with or disrupt the service, attempt to bypass usage limits or security controls, scrape or reverse engineer the service beyond allowed use, or generate discriminatory or unlawful real estate content.',
  },
  {
    title: '9. Fees, Billing, and Subscriptions',
    body: 'Certain features may require payment. If you purchase a paid plan, you agree to pay all applicable charges, taxes, and fees. Subscription billing, renewals, trials, cancellations, and refunds are governed by the specific plan terms presented at purchase and by the billing platform used to process payments.',
  },
  {
    title: '10. Usage Limits and Safeguards',
    body: 'We may enforce usage limits, cooldown periods, caching behavior, plan-based quotas, and anti-abuse measures to protect the platform and control third-party costs. Repeated requests may return cached results instead of triggering new analyses.',
  },
  {
    title: '11. Intellectual Property',
    body: 'The service, including its design, software, workflows, branding, and underlying technology, is owned by Workside or its licensors and is protected by applicable intellectual property laws. Except as expressly allowed, you may not copy, modify, distribute, sell, or exploit the service or its components.',
  },
  {
    title: '12. Privacy',
    body: 'Your use of the service is also subject to our Privacy Policy.',
  },
  {
    title: '13. Availability and Changes',
    body: 'We may modify, suspend, or discontinue any part of the service at any time, with or without notice. We do not guarantee uninterrupted availability.',
  },
  {
    title: '14. Disclaimers',
    body: 'THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, OR RELIABILITY.',
  },
  {
    title: '15. Limitation of Liability',
    paragraphs: [
      'To the maximum extent permitted by law, Workside and its affiliates, officers, employees, and contractors will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, revenue, data, goodwill, or business opportunities arising out of or related to your use of the service.',
      'To the maximum extent permitted by law, our total liability for claims arising out of or related to the service will not exceed the amount you paid to us for the service in the twelve months before the event giving rise to the claim, or one hundred U.S. dollars (US $100), whichever is greater.',
    ],
  },
  {
    title: '16. Indemnification',
    body: 'You agree to indemnify and hold harmless Workside from claims, damages, liabilities, costs, and expenses arising out of your use of the service, your content, your violation of these Terms, or your violation of any law or third-party rights.',
  },
  {
    title: '17. Termination',
    body: 'We may suspend or terminate your access if you violate these Terms, create risk for the platform, fail to pay applicable fees, or misuse the service. You may stop using the service at any time.',
  },
  {
    title: '18. Governing Law',
    body: 'These Terms are governed by the laws of the jurisdiction selected by Workside in its principal place of business, without regard to conflict-of-law principles, except where applicable law requires otherwise.',
  },
  {
    title: '19. Changes to These Terms',
    body: 'We may update these Terms from time to time. Continued use of the service after updated Terms become effective constitutes acceptance of the updated Terms.',
  },
];

export default function TermsPage() {
  return (
    <AppFrame>
      <section className="panel-card legal-page">
        <div className="section-eyebrow">Legal</div>
        <h1>Terms of Service</h1>
        <p className="legal-meta">Workside Software LLC • Effective Date: March 29, 2026</p>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Workside
          Home Advisor and related websites, applications, and services operated by Workside
          Software (&ldquo;Workside,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). By
          accessing or using the service, you agree to these Terms.
        </p>

        <div className="legal-notice">
          Workside Home Advisor provides software tools, AI-assisted suggestions, property-preparation guidance, and related workflow features. It does not provide legal advice, brokerage services, appraisal services, title services, inspection services, or guaranteed real estate outcomes. Workside is not a real estate brokerage.
        </div>

        {sections.map((section) => (
          <div key={section.title} className="legal-section">
            <h2>{section.title}</h2>
            {section.body ? <p>{section.body}</p> : null}
            {section.paragraphs
              ? section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
              : null}
            {section.items ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}

        <div className="legal-section">
          <h2>20. Contact</h2>
          <p>
            If you have questions about these Terms, contact Workside Software LLC at{' '}
            <a href="mailto:support@worksidesoftware.com">support@worksidesoftware.com</a>.
          </p>
        </div>

        <p className="legal-footer">
          © 2026 Workside Software LLC. All rights reserved.
          <br />
          8612 Mainsail Drive, Bakersfield, CA 93312
          <br />
          Email: support@worksidesoftware.com
        </p>
      </section>
    </AppFrame>
  );
}
