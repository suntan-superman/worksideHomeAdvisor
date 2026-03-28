import Stripe from 'stripe';

import { env } from '../config/env.js';

let stripeClient = null;

const PLAN_CATALOG = {
  seller_unlock: {
    productKey: 'seller',
    planKey: 'seller_unlock',
    mode: 'payment',
    audience: 'seller',
    displayName: 'Seller Unlock',
    description: 'Unlock flyer generation, exports, and richer seller-ready outputs.',
    priceEnvKey: 'STRIPE_PRICE_ID_SELLER_UNLOCK',
    features: ['pricing.full', 'flyer.generate', 'flyer.export', 'marketing.export', 'reports.client_ready'],
  },
  seller_pro: {
    productKey: 'seller',
    planKey: 'seller_pro',
    mode: 'subscription',
    audience: 'seller',
    displayName: 'Seller Pro',
    description: 'Ongoing seller access for deeper pricing, exports, and AI guidance.',
    priceEnvKey: 'STRIPE_PRICE_ID_SELLER_PRO',
    features: ['pricing.full', 'flyer.generate', 'flyer.export', 'marketing.export', 'reports.client_ready'],
  },
  agent_starter: {
    productKey: 'agent',
    planKey: 'agent_starter',
    mode: 'subscription',
    audience: 'agent',
    displayName: 'Agent Starter',
    description: 'Presentation-ready pricing and listing-prep workflows for agents.',
    priceEnvKey: 'STRIPE_PRICE_ID_AGENT_STARTER',
    features: [
      'pricing.full',
      'flyer.generate',
      'flyer.export',
      'marketing.export',
      'reports.client_ready',
      'presentation.mode',
    ],
  },
  agent_pro: {
    productKey: 'agent',
    planKey: 'agent_pro',
    mode: 'subscription',
    audience: 'agent',
    displayName: 'Agent Pro',
    description: 'Generate pricing, comps, and listing presentations in minutes.',
    priceEnvKey: 'STRIPE_PRICE_ID_AGENT_PRO',
    features: [
      'pricing.full',
      'flyer.generate',
      'flyer.export',
      'marketing.export',
      'presentation.mode',
      'branding.custom',
      'reports.client_ready',
    ],
  },
  agent_team: {
    productKey: 'agent',
    planKey: 'agent_team',
    mode: 'subscription',
    audience: 'agent',
    displayName: 'Agent Team',
    description: 'Team-oriented access for higher-volume listing workflows.',
    priceEnvKey: 'STRIPE_PRICE_ID_AGENT_TEAM',
    features: [
      'pricing.full',
      'flyer.generate',
      'flyer.export',
      'marketing.export',
      'presentation.mode',
      'branding.custom',
      'reports.client_ready',
      'team.multi_user',
    ],
  },
  sample_onboarding: {
    productKey: 'demo',
    planKey: 'sample_onboarding',
    mode: 'payment',
    audience: 'demo',
    displayName: 'Sample Onboarding Fee',
    description: 'Low-cost one-time Stripe flow for demos and live billing tests.',
    priceEnvKey: 'STRIPE_PRICE_ID_SAMPLE_ONBOARDING',
    features: ['pricing.full', 'flyer.generate', 'flyer.export', 'marketing.export'],
  },
  sample_monthly: {
    productKey: 'demo',
    planKey: 'sample_monthly',
    mode: 'subscription',
    audience: 'demo',
    displayName: 'Sample Monthly Fee',
    description: 'Low-cost recurring Stripe flow for demos and live subscription tests.',
    priceEnvKey: 'STRIPE_PRICE_ID_SAMPLE_MONTHLY',
    features: [
      'pricing.full',
      'flyer.generate',
      'flyer.export',
      'marketing.export',
      'reports.client_ready',
      'presentation.mode',
    ],
  },
};

export function isStripeConfigured() {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function getStripeClient() {
  if (!env.STRIPE_SECRET_KEY) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

export function listPlanCatalog() {
  return Object.values(PLAN_CATALOG).map((plan) => ({
    ...plan,
    priceId: env[plan.priceEnvKey] || null,
    configured: Boolean(env[plan.priceEnvKey]),
  }));
}

export function getPlanConfig(planKey) {
  const plan = PLAN_CATALOG[planKey];
  if (!plan) {
    throw new Error('Unknown billing plan.');
  }

  const priceId = env[plan.priceEnvKey];
  if (!priceId) {
    throw new Error(`Missing Stripe price id for plan "${planKey}".`);
  }

  return {
    ...plan,
    priceId,
  };
}

export function resolveBillingUrls(overrides = {}) {
  return {
    successUrl:
      overrides.successUrl ||
      env.STRIPE_BILLING_SUCCESS_URL ||
      `${env.PUBLIC_WEB_URL}/dashboard?billing=success`,
    cancelUrl:
      overrides.cancelUrl ||
      env.STRIPE_BILLING_CANCEL_URL ||
      `${env.PUBLIC_WEB_URL}/dashboard?billing=cancelled`,
  };
}
