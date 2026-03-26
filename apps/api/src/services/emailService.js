import nodemailer from 'nodemailer';

import { env } from '../config/env.js';
import { logInfo } from '../lib/logger.js';

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

export async function sendOtpEmail({ to, code }) {
  if (!transport) {
    logInfo('OTP email captured in console mode', { to, code });
    return;
  }

  await transport.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: 'Verify your Workside Home Seller account',
    text: `Your verification code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes.`,
  });
}
