import { BRANDING } from '@workside/branding';

import { AppFrame } from '../../components/AppFrame';

const sections = [
  {
    title: '1. Information We Collect',
    items: [
      '<strong>Account information:</strong> name, email address, password credentials or authentication tokens, phone number, account settings, and subscription details.',
      '<strong>Property information:</strong> addresses, property details, room information, status, pricing inputs, uploaded images, notes, checklists, and related content.',
      '<strong>User content:</strong> photos, descriptions, drafts, marketing materials, provider selections, comments, and other information you submit.',
      '<strong>Usage information:</strong> interactions with the service, pages/screens viewed, button clicks, analysis requests, device information, IP address, browser/app details, timestamps, and diagnostic logs.',
      '<strong>Payment and billing information:</strong> subscription status, billing history, and limited payment-related metadata from payment processors.',
      '<strong>Third-party data:</strong> market data, comparable property information, provider listings, geolocation-related data, or other third-party content used to operate the service.',
    ],
  },
  {
    title: '2. How We Use Information',
    items: [
      'Provide, operate, maintain, and improve the service.',
      'Create and manage accounts.',
      'Authenticate users and secure the platform.',
      'Generate pricing guidance, visualizations, AI-assisted content, and workflow recommendations.',
      'Process uploads, analyses, exports, notifications, and support requests.',
      'Communicate with you about your account, billing, product updates, and service notices.',
      'Enforce terms, usage limits, anti-abuse rules, and security protections.',
      'Analyze product usage, performance, conversion, and cost patterns.',
      'Comply with legal obligations and protect rights, safety, and property.',
    ],
  },
  {
    title: '3. AI and Automated Processing',
    body: 'We may use artificial intelligence and automated tools to analyze property information, photos, room details, pricing inputs, and related user content. These tools may generate suggestions, summaries, classifications, visualizations, or other outputs. Automated outputs may be inaccurate or incomplete and should be independently reviewed.',
  },
  {
    title: '4. SMS Communications',
    body: 'We may send transactional SMS messages to users and providers who have provided consent. Messages may include account notifications, service requests, provider marketplace interactions, and workflow updates. Users and providers can opt out by replying STOP or request help by replying HELP. Message frequency varies.',
  },
  {
    title: '5. Image Processing and Third-Party AI Providers',
    body: 'Uploaded images may be processed by third-party AI providers for enhancement, analysis, conceptual visualization, or document-generation workflows. Those providers may temporarily process image content and related metadata as needed to perform the requested service on our behalf.',
  },
  {
    title: '6. How We Share Information',
    items: [
      '<strong>Service providers:</strong> vendors who help us provide the service, such as hosting, authentication, storage, analytics, email delivery, payment processing, mapping, AI, and market-data providers.',
      '<strong>Provider marketplace features:</strong> if you request contact with a listed provider or choose to share your information with them.',
      '<strong>Legal and safety reasons:</strong> when required by law, subpoena, court order, or to protect rights, users, or the public.',
      '<strong>Business transfers:</strong> in connection with a merger, acquisition, financing, restructuring, or sale of assets.',
      '<strong>With your direction:</strong> when you explicitly choose to share or export information.',
    ],
  },
  {
    title: '7. Cookies, Tracking, and Similar Technologies',
    body: 'We may use cookies, local storage, pixels, SDKs, and similar technologies to keep you logged in, remember preferences, understand product usage, measure performance, and improve the service.',
  },
  {
    title: '8. Data Retention',
    body: 'We retain information for as long as reasonably necessary to provide the service, maintain business and legal records, enforce agreements, resolve disputes, support security and abuse prevention, and meet legal obligations.',
  },
  {
    title: '9. Data Security',
    body: 'We use reasonable administrative, technical, and organizational measures to protect information. However, no method of storage or transmission is completely secure, and we cannot guarantee absolute security.',
  },
  {
    title: '10. Your Choices',
    body: 'Depending on your location and applicable law, you may have choices or rights regarding your information, such as the ability to access, update, delete, or export certain data, opt out of certain communications, or manage cookies/preferences.',
  },
  {
    title: '11. Third-Party Services',
    body: 'The service may rely on third-party services such as payment processors, analytics providers, AI providers, cloud hosting providers, maps providers, and market-data vendors. Their handling of information is subject to their own terms and privacy practices.',
  },
  {
    title: '12. Children’s Privacy',
    body: 'The service is not intended for children under the age required by applicable law to consent to data processing. We do not knowingly collect personal information from children in violation of applicable law.',
  },
  {
    title: '13. International Users',
    body: 'If you access the service from outside the country where our systems or providers operate, your information may be transferred to and processed in other jurisdictions that may have different data-protection laws.',
  },
  {
    title: '14. Provider Listings and Sponsored Content',
    body: 'The service may show provider listings, including sponsored placements. Sponsored providers may receive enhanced visibility. We may track provider interactions such as views, clicks, saves, and contact requests to operate the marketplace and related billing or analytics features.',
  },
  {
    title: '15. Changes to This Privacy Policy',
    body: 'We may update this Privacy Policy from time to time. If we make material changes, we may provide notice through the service or by other appropriate means.',
  },
];

export default function PrivacyPage() {
  return (
    <AppFrame>
      <section className="panel-card legal-page">
        <div className="section-eyebrow">Legal</div>
        <h1>Privacy Policy</h1>
        <p className="legal-meta">{BRANDING.companyName} LLC • Effective Date: March 29, 2026</p>
        <p>
          This Privacy Policy explains how Workside Home Advisor (&ldquo;Workside,&rdquo; &ldquo;we,&rdquo;
          &ldquo;our,&rdquo; or &ldquo;us&rdquo;) collects, uses, discloses, and protects information in
          connection with Workside Home Advisor and related websites, applications, and services.
        </p>

        <div className="legal-notice">
          This template is designed as a practical website/app privacy page for Workside Home
          Advisor. Before production launch, it should be reviewed for your actual data flows,
          vendors, jurisdiction requirements, and any applicable legal obligations.
        </div>

        {sections.map((section) => (
          <div key={section.title} className="legal-section">
            <h2>{section.title}</h2>
            {section.body ? <p>{section.body}</p> : null}
            {section.items ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item} dangerouslySetInnerHTML={{ __html: item }} />
                ))}
              </ul>
            ) : null}
          </div>
        ))}

        <div className="legal-section">
          <h2>16. Contact</h2>
          <p>
            If you have questions about this Privacy Policy or your information, contact {BRANDING.companyName}
            LLC at <a href={`mailto:${BRANDING.supportEmail}`}>{BRANDING.supportEmail}</a>.
          </p>
        </div>

        <p className="legal-footer">
          © 2026 {BRANDING.companyName} LLC. All rights reserved.
          <br />
          8612 Mainsail Drive, Bakersfield, CA 93312
          <br />
          Email: {BRANDING.supportEmail}
        </p>
      </section>
    </AppFrame>
  );
}
