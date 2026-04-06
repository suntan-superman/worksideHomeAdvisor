import Link from 'next/link';
import { BRANDING } from '@workside/branding';

import { AppFrame } from '../../components/AppFrame';

const sections = [
  {
    title: '1. Transactional SMS Notifications',
    paragraphs: [
      'Workside Home Advisor may send transactional and service-related SMS messages to users and providers who give explicit consent where required. These messages may include account verification, lead routing responses, appointment coordination, checklist or workflow updates, and account-related notices.',
      'Messages are strictly transactional and not promotional.',
      'Consent to receive SMS messages is not a condition of purchasing any goods or services.',
    ],
  },
  {
    title: '2. How Consent Is Collected',
    paragraphs: [
      'Consent is collected through Workside-controlled forms and workflows that include an unchecked opt-in control presented alongside the phone field or within provider onboarding and marketplace-related messaging flows.',
      'The consent control is not preselected. A user or provider must take an affirmative action to opt in before SMS messaging is enabled.',
    ],
    quote:
      'I agree to receive SMS messages from Workside Home Advisor regarding account verification, service updates, provider lead notifications, and related transactional communications. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for assistance.',
  },
  {
    title: '3. Message Terms',
    items: [
      'Message frequency varies based on account activity and provider lead volume.',
      'Message and data rates may apply.',
      'Reply STOP at any time to opt out.',
      'Reply HELP for assistance.',
      'Some messages may be sent to support seller workflows, provider marketplace routing, and account security.',
    ],
  },
  {
    title: '4. Consent Records',
    paragraphs: [
      'Opt-in events may be logged with timestamp, phone number, account or provider reference, and other audit details necessary to demonstrate consent and support compliance.',
      'Workside Home Advisor does not send SMS messages without an appropriate consent basis for the applicable use case.',
    ],
  },
  {
    title: '5. No Marketing Messages',
    paragraphs: [
      'Workside does not send promotional SMS messages.',
      'Workside Home Advisor messaging is limited to transactional, operational, and service-related communications.',
    ],
  },
  {
    title: '6. Privacy and Data Use',
    paragraphs: [
      'Mobile phone numbers and consent records are used to operate the Workside service, support transactional communications, and maintain compliance records.',
      'Workside Home Advisor does not sell, rent, or share mobile phone numbers for third-party marketing purposes.',
    ],
  },
];

export const metadata = {
  title: 'SMS Consent | Workside Home Advisor',
  description: 'SMS consent and messaging disclosure for Workside Home Advisor.',
};

export default function SmsConsentPage() {
  return (
    <AppFrame>
      <section className="panel-card legal-page">
        <div className="section-eyebrow">Legal</div>
        <h1>SMS Consent &amp; Messaging Disclosure</h1>
        <p className="legal-meta">{BRANDING.companyName} LLC • Effective Date: March 29, 2026</p>
        <p>
          This page explains how Workside Home Advisor collects consent for SMS messaging used in
          Workside Home Advisor and related provider-marketplace workflows.
        </p>

        <div className="legal-notice">
          This disclosure is intended to support transactional SMS compliance for Workside Home
          Advisor, including account-related and provider-marketplace messaging.
        </div>

        {sections.map((section) => (
          <div key={section.title} className="legal-section">
            <h2>{section.title}</h2>
            {section.paragraphs
              ? section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
              : null}
            {section.quote ? <blockquote className="legal-quote">{section.quote}</blockquote> : null}
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
          <h2>7. Related Policies</h2>
          <p>
            For more information about how Workside handles personal information and the terms that
            govern use of the service, review the linked policies below.
          </p>
          <ul>
            <li>
              <Link href="/privacy">Privacy Policy</Link>
            </li>
            <li>
              <Link href="/terms">Terms of Service</Link>
            </li>
          </ul>
        </div>

        <div className="legal-section">
          <h2>8. Contact</h2>
          <p>
            Questions about SMS consent, opt-out requests, or messaging support can be sent to{' '}
            <a href={`mailto:${BRANDING.supportEmail}`}>{BRANDING.supportEmail}</a>.
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
