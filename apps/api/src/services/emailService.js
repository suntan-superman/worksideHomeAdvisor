import nodemailer from 'nodemailer';
import { BRANDING, BRAND_TOKENS } from '@workside/branding';

import { env } from '../config/env.js';
import { logError, logInfo } from '../lib/logger.js';

function createTransport() {
  if (env.EMAIL_PROVIDER !== 'smtp') {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

const transport = createTransport();

function getFromEmail() {
  return env.SENDGRID_FROM_EMAIL || env.EMAIL_FROM;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEmailShell({ eyebrow, title, intro, bodyHtml, footerNote }) {
  const colors = BRAND_TOKENS.colors;

  return `
    <div style="margin: 0; padding: 32px 16px; background: ${colors.sand};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; margin: 0 auto; border-collapse: collapse;">
        <tr>
          <td style="padding-bottom: 16px; font-family: Arial, sans-serif; color: ${colors.moss}; font-size: 12px; letter-spacing: 1.8px; text-transform: uppercase;">
            ${escapeHtml(BRANDING.companyName)}
          </td>
        </tr>
        <tr>
          <td style="background: ${colors.cream}; border-radius: 28px; padding: 32px; border: 1px solid #ead9cb; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);">
            <div style="font-family: Arial, sans-serif; color: ${colors.moss}; font-size: 12px; letter-spacing: 1.8px; text-transform: uppercase; margin-bottom: 12px;">
              ${escapeHtml(eyebrow)}
            </div>
            <h1 style="margin: 0 0 14px; font-family: Arial, sans-serif; color: ${colors.ink}; font-size: 32px; line-height: 1.15;">
              ${escapeHtml(title)}
            </h1>
            <p style="margin: 0 0 20px; font-family: Arial, sans-serif; color: ${colors.slate}; font-size: 16px; line-height: 1.7;">
              ${escapeHtml(intro)}
            </p>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding: 18px 8px 0; font-family: Arial, sans-serif; color: #6b7280; font-size: 13px; line-height: 1.6;">
            ${escapeHtml(footerNote)}<br />
            Need help? Reply to this email or visit <a href="${escapeHtml(env.PUBLIC_WEB_URL)}" style="color: ${colors.clay}; text-decoration: none;">${escapeHtml(BRANDING.shortProductName)}</a>.
          </td>
        </tr>
      </table>
    </div>
  `.trim();
}

function renderCodeCard(code) {
  const colors = BRAND_TOKENS.colors;

  return `
    <div style="margin: 0 0 22px; padding: 22px; border-radius: 22px; background: #fff3eb; border: 1px solid #f1d1be; text-align: center;">
      <div style="font-family: Arial, sans-serif; color: ${colors.moss}; font-size: 12px; letter-spacing: 1.8px; text-transform: uppercase; margin-bottom: 10px;">
        Verification Code
      </div>
      <div style="font-family: Arial, sans-serif; color: ${colors.clay}; font-size: 34px; font-weight: 700; letter-spacing: 8px;">
        ${escapeHtml(code)}
      </div>
    </div>
  `.trim();
}

function renderButton(label, href) {
  const colors = BRAND_TOKENS.colors;

  return `
    <a href="${escapeHtml(href)}" style="display: inline-block; padding: 13px 20px; border-radius: 12px; background: ${colors.clay}; color: #fff7f0; text-decoration: none; font-family: Arial, sans-serif; font-weight: 700;">
      ${escapeHtml(label)}
    </a>
  `.trim();
}

async function sendViaSendGrid({ to, subject, text, html }) {
  if (!env.SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY must be configured when EMAIL_PROVIDER=sendgrid.');
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: to }],
        },
      ],
      from: {
        email: getFromEmail(),
        name: 'Workside Home Seller',
      },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.errors?.[0]?.message || `SendGrid request failed with status ${response.status}.`;
    throw new Error(message);
  }
}

async function sendViaSmtp({ to, subject, text, html }) {
  if (!transport) {
    throw new Error('SMTP transport is not configured.');
  }

  await transport.sendMail({
    from: getFromEmail(),
    to,
    subject,
    text,
    html,
  });
}

async function deliverEmail({ to, subject, text, html, logLabel, logMeta }) {
  if (env.EMAIL_PROVIDER === 'console') {
    logInfo(`${logLabel} captured in console mode`, { to, ...logMeta });
    return;
  }

  if (env.EMAIL_PROVIDER === 'smtp') {
    await sendViaSmtp({ to, subject, text, html });
    return;
  }

  await sendViaSendGrid({ to, subject, text, html });
}

function buildOtpHtml(code, role = 'seller') {
  const workspaceLabel =
    role === 'provider'
      ? 'provider portal'
      : role === 'agent'
        ? 'agent workspace'
        : 'seller workspace';

  return renderEmailShell({
    eyebrow: 'Email verification',
    title: 'Confirm your email to start selling smarter.',
    intro: `Use this one-time verification code to unlock your ${BRANDING.shortProductName} ${workspaceLabel}.`,
    bodyHtml: `
      ${renderCodeCard(code)}
      <p style="margin: 0 0 14px; font-family: Arial, sans-serif; color: ${BRAND_TOKENS.colors.slate}; font-size: 15px; line-height: 1.7;">
        This code expires in ${env.OTP_TTL_MINUTES} minutes. If you did not request it, you can safely ignore this email.
      </p>
      <p style="margin: 0; font-family: Arial, sans-serif; color: ${BRAND_TOKENS.colors.slate}; font-size: 15px; line-height: 1.7;">
        We recommend returning to the app or browser where you signed up and entering the code there to finish verification.
      </p>
    `.trim(),
    footerNote: `${BRANDING.tagline} Verification emails are sent from ${getFromEmail()}.`,
  });
}

function buildWelcomeHtml(firstName = 'there', role = 'seller') {
  const safeFirstName = escapeHtml(firstName);
  const workspaceLabel =
    role === 'provider'
      ? 'provider workspace'
      : role === 'agent'
        ? 'agent workspace'
        : 'seller workspace';
  const intro =
    role === 'provider'
      ? `You’re all set to manage your marketplace profile, provider leads, and billing setup inside ${BRANDING.shortProductName}.`
      : role === 'agent'
        ? `You’re all set to start pricing properties, reviewing prep guidance, and using listing presentation tools built for agents.`
        : `You’re all set to start preparing your property with pricing insights, photo guidance, and AI support built for home sellers.`;
  const nextStepItems =
    role === 'provider'
      ? `
          <li>Finish your provider profile and service area coverage</li>
          <li>Complete billing setup if you selected a paid provider plan</li>
          <li>Review and respond to seller lead requests in the provider portal</li>
        `
      : role === 'agent'
        ? `
          <li>Add a property and review pricing guidance</li>
          <li>Build listing-ready reports, comps, and presentation materials</li>
          <li>Use AI guidance to accelerate listing prep decisions</li>
        `
        : `
          <li>Add your property and organize the selling workflow</li>
          <li>Review pricing guidance powered by market data and AI</li>
          <li>Capture listing photos and get room-by-room quality feedback</li>
        `;

  return renderEmailShell({
    eyebrow: 'Welcome aboard',
    title: `Welcome, ${safeFirstName}. Your ${workspaceLabel} is live.`,
    intro,
    bodyHtml: `
      <div style="margin: 0 0 22px; padding: 22px; border-radius: 22px; background: #f6efe8; border: 1px solid #ead9cb;">
        <div style="font-family: Arial, sans-serif; color: ${BRAND_TOKENS.colors.ink}; font-size: 16px; line-height: 1.7; margin-bottom: 12px;">
          Here’s what you can do next:
        </div>
        <ul style="margin: 0; padding-left: 18px; font-family: Arial, sans-serif; color: ${BRAND_TOKENS.colors.slate}; font-size: 15px; line-height: 1.8;">
          ${nextStepItems}
        </ul>
      </div>
      <div style="margin: 0 0 18px;">
        ${renderButton(
          role === 'provider'
            ? 'Open provider portal'
            : role === 'agent'
              ? 'Open your agent workspace'
              : 'Open your seller workspace',
          role === 'provider' ? `${env.PUBLIC_WEB_URL}/providers/portal` : env.PUBLIC_WEB_URL,
        )}
      </div>
      <p style="margin: 0; font-family: Arial, sans-serif; color: ${BRAND_TOKENS.colors.slate}; font-size: 15px; line-height: 1.7;">
        We’re glad you’re here, and we’ll help you move from prep to listing with more confidence.
      </p>
    `.trim(),
    footerNote: `${BRANDING.footerCopy} ${BRANDING.supportEmail}`,
  });
}

export async function sendOtpEmail({ to, code, role = 'seller' }) {
  const subject =
    role === 'provider'
      ? 'Verify your Workside Provider account'
      : role === 'agent'
        ? 'Verify your Workside Agent account'
        : 'Verify your Workside Home Seller account';
  await deliverEmail({
    to,
    subject,
    text: [
      `Verify your ${BRANDING.shortProductName} account`,
      '',
      `Your verification code is: ${code}`,
      '',
      `This code expires in ${env.OTP_TTL_MINUTES} minutes.`,
      `If you did not request this email, you can ignore it.`,
      '',
      `${BRANDING.tagline}`,
      `Sent from ${getFromEmail()}`,
    ].join('\n'),
    html: buildOtpHtml(code, role),
    logLabel: 'OTP email',
    logMeta: { code, role },
  });
}

export async function sendWelcomeEmail({ to, firstName, role = 'seller' }) {
  const safeFirstName = firstName?.trim() || 'there';
  const subject =
    role === 'provider'
      ? 'Welcome to Workside Provider Portal'
      : role === 'agent'
        ? 'Welcome to Workside Agent Workspace'
        : 'Welcome to Workside Home Seller';
  const introLine =
    role === 'provider'
      ? `Hi ${safeFirstName}, your email has been verified and your provider workspace is ready.`
      : role === 'agent'
        ? `Hi ${safeFirstName}, your email has been verified and your agent workspace is ready.`
        : `Hi ${safeFirstName}, your email has been verified and your seller workspace is ready.`;
  const nextStepLines =
    role === 'provider'
      ? [
          '- Finish your provider profile',
          '- Complete billing setup if needed',
          '- Review provider leads in the portal',
        ]
      : role === 'agent'
        ? [
            '- Add a property',
            '- Review pricing guidance',
            '- Build reports and presentation materials',
          ]
        : [
            '- Add your property',
            '- Review pricing guidance',
            '- Capture listing photos and get AI feedback',
          ];
  const workspaceUrl = role === 'provider' ? `${env.PUBLIC_WEB_URL}/providers/portal` : env.PUBLIC_WEB_URL;

  try {
    await deliverEmail({
      to,
      subject,
      text: [
        `Welcome to ${BRANDING.shortProductName}`,
        '',
        introLine,
        '',
        'Next steps:',
        ...nextStepLines,
        '',
        `Open your workspace: ${workspaceUrl}`,
        '',
        `${BRANDING.footerCopy} ${BRANDING.supportEmail}`,
      ].join('\n'),
      html: buildWelcomeHtml(safeFirstName, role),
      logLabel: 'Welcome email',
      logMeta: { firstName: safeFirstName, role },
    });
  } catch (error) {
    logError('Welcome email failed', {
      to,
      message: error.message,
    });
  }
}

function buildProviderLeadHtml({
  providerName = 'there',
  categoryLabel = 'service provider',
  propertyAddress = '',
  message = '',
  portalUrl = '',
}) {
  const safeProviderName = escapeHtml(providerName);
  const safeCategoryLabel = escapeHtml(categoryLabel);
  const safePropertyAddress = escapeHtml(propertyAddress || 'the requested property');
  const safeMessage = escapeHtml(message || '');

  return renderEmailShell({
    eyebrow: 'New provider lead',
    title: `A seller needs ${safeCategoryLabel.toLowerCase()} support.`,
    intro: `Hi ${safeProviderName}, a Workside user requested help for ${safePropertyAddress}.`,
    bodyHtml: `
      <div style="margin: 0 0 22px; padding: 22px; border-radius: 22px; background: #f6efe8; border: 1px solid #ead9cb;">
        <div style="font-family: Arial, sans-serif; color: ${BRAND_TOKENS.colors.ink}; font-size: 16px; font-weight: 700; margin-bottom: 8px;">
          Property
        </div>
        <div style="font-family: Arial, sans-serif; color: ${BRAND_TOKENS.colors.slate}; font-size: 15px; line-height: 1.7;">
          ${safePropertyAddress}
        </div>
      </div>
      ${
        safeMessage
          ? `
      <div style="margin: 0 0 22px; padding: 22px; border-radius: 22px; background: #fff8f2; border: 1px solid #f1d1be;">
        <div style="font-family: Arial, sans-serif; color: ${BRAND_TOKENS.colors.ink}; font-size: 16px; font-weight: 700; margin-bottom: 8px;">
          Seller request
        </div>
        <div style="font-family: Arial, sans-serif; color: ${BRAND_TOKENS.colors.slate}; font-size: 15px; line-height: 1.7;">
          ${safeMessage}
        </div>
      </div>`
          : ''
      }
      <div style="margin: 0 0 18px;">
        ${
          portalUrl
            ? renderButton('Open provider portal', portalUrl)
            : renderButton('Reply by email', `mailto:${escapeHtml(BRANDING.supportEmail)}`)
        }
      </div>
      <p style="margin: 0; font-family: Arial, sans-serif; color: ${BRAND_TOKENS.colors.slate}; font-size: 15px; line-height: 1.7;">
        You can reply to this email if you would like Workside to connect you with the customer by email while SMS approval is still pending.
      </p>
    `.trim(),
    footerNote: `${BRANDING.footerCopy} ${BRANDING.supportEmail}`,
  });
}

export async function sendProviderLeadEmail({
  to,
  providerName,
  categoryLabel,
  propertyAddress,
  message = '',
  portalUrl = '',
}) {
  await deliverEmail({
    to,
    subject: `New Workside lead: ${categoryLabel || 'Provider request'}`,
    text: [
      'New Workside provider lead',
      '',
      `A seller requested ${categoryLabel || 'service'} support for:`,
      propertyAddress || 'Property address not provided',
      '',
      message ? `Seller request: ${message}` : '',
      portalUrl ? `Open provider portal: ${portalUrl}` : '',
      '',
      `Reply to this email or contact ${BRANDING.supportEmail} for help.`,
    ]
      .filter(Boolean)
      .join('\n'),
    html: buildProviderLeadHtml({
      providerName,
      categoryLabel,
      propertyAddress,
      message,
      portalUrl,
    }),
    logLabel: 'Provider lead email',
    logMeta: { categoryLabel, propertyAddress },
  });
}
