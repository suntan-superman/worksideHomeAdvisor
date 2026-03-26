import nodemailer from 'nodemailer';

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
  return `
    <div style="font-family: Arial, sans-serif; color: #1e2933; line-height: 1.6;">
      <h1 style="margin-bottom: 12px;">Verify your Workside account</h1>
      <p>Welcome to Workside Home Seller. Use the code below to verify your email address.</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 20px 0; color: #b96f47;">
        ${code}
      </div>
      <p>This code expires in ${env.OTP_TTL_MINUTES} minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `.trim();
}

function buildWelcomeHtml(firstName = 'there') {
  return `
    <div style="font-family: Arial, sans-serif; color: #1e2933; line-height: 1.6;">
      <h1 style="margin-bottom: 12px;">Welcome to Workside Home Seller</h1>
      <p>Hi ${firstName}, your email has been verified and your seller workspace is ready.</p>
      <p>You can now organize your property, review pricing guidance, capture listing photos, and get AI suggestions for prep and marketing.</p>
      <p>
        <a href="${env.PUBLIC_WEB_URL}" style="display: inline-block; padding: 12px 18px; background: #b96f47; color: #fff7f0; text-decoration: none; border-radius: 10px;">
          Open your seller workspace
        </a>
      </p>
      <p>We’re glad you’re here.</p>
    </div>
  `.trim();
}

export async function sendOtpEmail({ to, code }) {
  await deliverEmail({
    to,
    subject: 'Verify your Workside Home Seller account',
    text: `Welcome to Workside Home Seller. Your verification code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes.`,
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
      text: `Hi ${safeFirstName}, your email has been verified and your seller workspace is ready. Visit ${env.PUBLIC_WEB_URL} to get started.`,
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
