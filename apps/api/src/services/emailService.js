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

function buildOtpHtml(code) {
  return renderEmailShell({
    eyebrow: 'Email verification',
    title: 'Confirm your email to start selling smarter.',
    intro: `Use this one-time verification code to unlock your ${BRANDING.shortProductName} workspace.`,
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

function buildWelcomeHtml(firstName = 'there') {
  const safeFirstName = escapeHtml(firstName);

  return renderEmailShell({
    eyebrow: 'Welcome aboard',
    title: `Welcome, ${safeFirstName}. Your seller workspace is live.`,
    intro: `You’re all set to start preparing your property with pricing insights, photo guidance, and AI support built for home sellers.`,
    bodyHtml: `
      <div style="margin: 0 0 22px; padding: 22px; border-radius: 22px; background: #f6efe8; border: 1px solid #ead9cb;">
        <div style="font-family: Arial, sans-serif; color: ${BRAND_TOKENS.colors.ink}; font-size: 16px; line-height: 1.7; margin-bottom: 12px;">
          Here’s what you can do next:
        </div>
        <ul style="margin: 0; padding-left: 18px; font-family: Arial, sans-serif; color: ${BRAND_TOKENS.colors.slate}; font-size: 15px; line-height: 1.8;">
          <li>Add your property and organize the selling workflow</li>
          <li>Review pricing guidance powered by market data and AI</li>
          <li>Capture listing photos and get room-by-room quality feedback</li>
        </ul>
      </div>
      <div style="margin: 0 0 18px;">
        ${renderButton('Open your seller workspace', env.PUBLIC_WEB_URL)}
      </div>
      <p style="margin: 0; font-family: Arial, sans-serif; color: ${BRAND_TOKENS.colors.slate}; font-size: 15px; line-height: 1.7;">
        We’re glad you’re here, and we’ll help you move from prep to listing with more confidence.
      </p>
    `.trim(),
    footerNote: `${BRANDING.footerCopy} ${BRANDING.supportEmail}`,
  });
}

export async function sendOtpEmail({ to, code }) {
  await deliverEmail({
    to,
    subject: 'Verify your Workside Home Seller account',
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
    html: buildOtpHtml(code),
    logLabel: 'OTP email',
    logMeta: { code },
  });
}

export async function sendWelcomeEmail({ to, firstName }) {
  const safeFirstName = firstName?.trim() || 'there';

  try {
    await deliverEmail({
      to,
      subject: 'Welcome to Workside Home Seller',
      text: [
        `Welcome to ${BRANDING.shortProductName}`,
        '',
        `Hi ${safeFirstName}, your email has been verified and your seller workspace is ready.`,
        '',
        'Next steps:',
        '- Add your property',
        '- Review pricing guidance',
        '- Capture listing photos and get AI feedback',
        '',
        `Open your workspace: ${env.PUBLIC_WEB_URL}`,
        '',
        `${BRANDING.footerCopy} ${BRANDING.supportEmail}`,
      ].join('\n'),
      html: buildWelcomeHtml(safeFirstName),
      logLabel: 'Welcome email',
      logMeta: { firstName: safeFirstName },
    });
  } catch (error) {
    logError('Welcome email failed', {
      to,
      message: error.message,
    });
  }
}
