import mongoose from 'mongoose';

import { env } from '../../config/env.js';
import {
  getPlanConfig,
  getStripeClient,
  isStripeConfigured,
  listPlanCatalog,
  listPlanCatalogWithPricing,
  resolveBillingUrls,
} from '../../services/stripeClient.js';
import { UserModel } from '../auth/auth.model.js';
import { BillingSubscriptionModel } from './billing.model.js';
import { ProviderModel } from '../providers/provider.model.js';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'paid']);
const BASE_FREE_FEATURES = ['pricing.preview', 'photo.capture.basic'];
const ADMIN_FEATURES = [
  'admin.full_access',
  'pricing.full',
  'flyer.generate',
  'flyer.export',
  'marketing.export',
  'presentation.mode',
  'branding.custom',
  'reports.client_ready',
  'team.multi_user',
];
const DEMO_FEATURES = [
  'pricing.full',
  'flyer.generate',
  'flyer.export',
  'marketing.export',
  'presentation.mode',
  'branding.custom',
  'reports.client_ready',
  'team.multi_user',
];

function toDateFromUnixTimestamp(value) {
  return value ? new Date(value * 1000) : null;
}

function isSubscriptionActive(status) {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status);
}

function toObjectIdString(value) {
  return value?.toString?.() || String(value);
}

function serializeSubscription(document) {
  if (!document) {
    return null;
  }

  return {
    id: document._id?.toString?.() || String(document._id),
    userId: document.userId?.toString?.() || String(document.userId),
    stripeCustomerId: document.stripeCustomerId || null,
    stripeCheckoutSessionId: document.stripeCheckoutSessionId || null,
    stripeSubscriptionId: document.stripeSubscriptionId || null,
    stripeInvoiceId: document.stripeInvoiceId || null,
    productKey: document.productKey,
    planKey: document.planKey,
    audience: document.audience,
    mode: document.mode,
    status: document.status,
    isActive: Boolean(document.isActive),
    trialEndsAt: document.trialEndsAt,
    currentPeriodStart: document.currentPeriodStart,
    currentPeriodEnd: document.currentPeriodEnd,
    cancelAt: document.cancelAt,
    cancelAtPeriodEnd: Boolean(document.cancelAtPeriodEnd),
    features: document.features || [],
    metadata: document.metadata || {},
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function buildFreeSummary(userId) {
  return {
    userId,
    isStripeConfigured: isStripeConfigured(),
    access: {
      audience: 'seller',
      planKey: 'free',
      status: 'free',
      features: BASE_FREE_FEATURES,
    },
    subscription: null,
  };
}

async function ensureStripeCustomer(user) {
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error('Stripe is not configured.');
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
    metadata: {
      userId: user._id.toString(),
      role: user.role,
    },
  });

  user.stripeCustomerId = customer.id;
  await user.save();

  return customer.id;
}

function buildCheckoutUrls(overrides) {
  const { successUrl, cancelUrl } = resolveBillingUrls(overrides);
  const separator = successUrl.includes('?') ? '&' : '?';

  return {
    successUrl: `${successUrl}${separator}session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl,
  };
}

function buildSharedBillingMetadata({
  app = 'home_advisor',
  billingKind,
  planKey,
  productKey,
  audience,
  priceId,
  userId = '',
  orgId = '',
  providerId = '',
}) {
  const resolvedOrgId = orgId || providerId || userId || '';

  return {
    app,
    billingKind,
    internalPlanCode: planKey,
    worksideUserId: userId || '',
    worksideOrgId: resolvedOrgId,
    worksideProviderId: providerId || '',
    userId: userId || '',
    providerId: providerId || '',
    planKey,
    productKey,
    audience,
    priceId,
  };
}

function buildProviderCheckoutUrls(providerId, overrides = {}) {
  const successBase =
    overrides.successUrl ||
    `${env.PUBLIC_WEB_URL}/providers/join?billing=success&providerId=${encodeURIComponent(providerId)}`;
  const cancelBase =
    overrides.cancelUrl ||
    `${env.PUBLIC_WEB_URL}/providers/join?billing=cancelled&providerId=${encodeURIComponent(providerId)}`;
  const separator = successBase.includes('?') ? '&' : '?';

  return {
    successUrl: `${successBase}${separator}session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: cancelBase,
  };
}

function planFromMetadataOrPrice(planKey, priceId) {
  if (planKey) {
    return getPlanConfig(planKey);
  }

  const plans = listPlanCatalog();
  const matchedPlan = plans.find((plan) => plan.priceId === priceId);
  if (!matchedPlan) {
    throw new Error('Could not resolve Stripe plan for subscription.');
  }

  return getPlanConfig(matchedPlan.planKey);
}

function resolvePlanKeyFromMetadata(metadata = {}) {
  return metadata.planKey || metadata.internalPlanCode || '';
}

function resolveUserIdFromMetadata(metadata = {}, fallback = '') {
  return metadata.userId || metadata.worksideUserId || fallback;
}

function resolveProviderIdFromMetadata(metadata = {}) {
  return metadata.providerId || metadata.worksideProviderId || '';
}

async function upsertSubscriptionRecord(query, values) {
  const document = await BillingSubscriptionModel.findOneAndUpdate(
    query,
    {
      $set: values,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  return serializeSubscription(document);
}

async function syncProviderCheckoutSession(session, plan) {
  const providerId = resolveProviderIdFromMetadata(session.metadata || {});
  if (!providerId) {
    throw new Error('Stripe checkout session is missing provider metadata.');
  }

  const provider = await ProviderModel.findById(providerId);
  if (!provider) {
    throw new Error('Provider not found for checkout session.');
  }

  provider.subscription.planCode = plan.planKey;
  provider.subscription.status = session.status || 'open';
  provider.subscription.stripeCustomerId = session.customer || provider.subscription.stripeCustomerId || '';
  provider.subscription.stripeCheckoutSessionId = session.id;
  provider.subscription.stripePriceId = plan.priceId;

  await provider.save();

  if (session.subscription) {
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(session.subscription, {
      expand: ['items.data.price'],
    });

    return syncProviderSubscription(subscription, {
      stripeCheckoutSessionId: session.id,
      metadata: session.metadata || {},
    });
  }

  return {
    providerId,
    planKey: plan.planKey,
    status: provider.subscription.status,
  };
}

async function syncProviderSubscription(subscription, overrides = {}) {
  const firstItem = subscription.items?.data?.[0];
  const plan = planFromMetadataOrPrice(
    resolvePlanKeyFromMetadata(subscription.metadata || {}) ||
      resolvePlanKeyFromMetadata(overrides.metadata || {}),
    firstItem?.price?.id,
  );
  const providerId =
    resolveProviderIdFromMetadata(subscription.metadata || {}) ||
    resolveProviderIdFromMetadata(overrides.metadata || {});

  if (!providerId) {
    throw new Error('Stripe subscription is missing provider metadata.');
  }

  const provider = await ProviderModel.findById(providerId);
  if (!provider) {
    throw new Error('Provider not found for Stripe subscription.');
  }

  provider.subscription.planCode = plan.planKey;
  provider.subscription.status = subscription.status;
  provider.subscription.stripeCustomerId = subscription.customer || provider.subscription.stripeCustomerId || '';
  provider.subscription.stripeCheckoutSessionId =
    overrides.stripeCheckoutSessionId || provider.subscription.stripeCheckoutSessionId || '';
  provider.subscription.stripeSubscriptionId = subscription.id;
  provider.subscription.stripePriceId = firstItem?.price?.id || plan.priceId || '';
  provider.subscription.currentPeriodStart = toDateFromUnixTimestamp(subscription.current_period_start);
  provider.subscription.currentPeriodEnd = toDateFromUnixTimestamp(subscription.current_period_end);
  provider.subscription.cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);

  const active = isSubscriptionActive(subscription.status);
  if (active) {
    provider.status = provider.status === 'suspended' ? 'suspended' : 'active';
    if (!provider.activatedAt) {
      provider.activatedAt = new Date();
    }
    provider.isSponsored = plan.planKey === 'provider_featured';
  } else if (provider.status !== 'suspended') {
    provider.status = 'paused';
    if (plan.planKey === 'provider_featured') {
      provider.isSponsored = false;
    }
  }

  await provider.save();

  return {
    providerId: toObjectIdString(provider._id),
    planKey: plan.planKey,
    status: provider.subscription.status,
    isActive: active,
  };
}

async function syncCheckoutSession(session) {
  const userId = resolveUserIdFromMetadata(session.metadata || {}, session.client_reference_id);
  const plan = planFromMetadataOrPrice(
    resolvePlanKeyFromMetadata(session.metadata || {}),
    session.metadata?.priceId,
  );

  if (plan.audience === 'provider') {
    return syncProviderCheckoutSession(session, plan);
  }

  if (!userId) {
    throw new Error('Stripe checkout session is missing user metadata.');
  }

  if (plan.mode === 'payment') {
    return upsertSubscriptionRecord(
      {
        stripeCheckoutSessionId: session.id,
      },
      {
        userId,
        stripeCustomerId: session.customer || null,
        stripeCheckoutSessionId: session.id,
        stripeInvoiceId: session.invoice || null,
        productKey: plan.productKey,
        planKey: plan.planKey,
        audience: plan.audience,
        mode: plan.mode,
        status: session.payment_status === 'paid' ? 'paid' : session.status || 'open',
        isActive: session.payment_status === 'paid',
        features: plan.features,
        metadata: session.metadata || {},
        rawStripeObject: session,
      },
    );
  }

  if (session.subscription) {
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(session.subscription, {
      expand: ['items.data.price'],
    });

    return syncStripeSubscription(subscription, {
      stripeCheckoutSessionId: session.id,
      metadata: session.metadata || {},
    });
  }

  return null;
}

export async function syncStripeCheckoutSessionById(sessionId) {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured.');
  }

  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedSessionId) {
    throw new Error('Stripe checkout session id is required.');
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(normalizedSessionId, {
    expand: ['subscription'],
  });

  return syncCheckoutSession(session);
}

async function syncStripeSubscription(subscription, overrides = {}) {
  const firstItem = subscription.items?.data?.[0];
  const plan = planFromMetadataOrPrice(
    resolvePlanKeyFromMetadata(subscription.metadata || {}) ||
      resolvePlanKeyFromMetadata(overrides.metadata || {}),
    firstItem?.price?.id,
  );

  if (plan.audience === 'provider') {
    return syncProviderSubscription(subscription, overrides);
  }

  const userId =
    resolveUserIdFromMetadata(subscription.metadata || {}) ||
    resolveUserIdFromMetadata(overrides.metadata || {}) ||
    subscription.customer_email;

  if (!userId) {
    throw new Error('Stripe subscription is missing user metadata.');
  }

  return upsertSubscriptionRecord(
    {
      stripeSubscriptionId: subscription.id,
    },
    {
      userId,
      stripeCustomerId: subscription.customer || null,
      stripeCheckoutSessionId: overrides.stripeCheckoutSessionId || null,
      stripeSubscriptionId: subscription.id,
      stripeInvoiceId: subscription.latest_invoice || null,
      productKey: plan.productKey,
      planKey: plan.planKey,
      audience: plan.audience,
      mode: plan.mode,
      status: subscription.status,
      isActive: isSubscriptionActive(subscription.status),
      trialEndsAt: toDateFromUnixTimestamp(subscription.trial_end),
      currentPeriodStart: toDateFromUnixTimestamp(subscription.current_period_start),
      currentPeriodEnd: toDateFromUnixTimestamp(subscription.current_period_end),
      cancelAt: toDateFromUnixTimestamp(subscription.cancel_at),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      features: plan.features,
      metadata: {
        ...overrides.metadata,
        ...subscription.metadata,
      },
      rawStripeObject: subscription,
    },
  );
}

async function syncInvoice(invoice) {
  if (!invoice.subscription) {
    return null;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription, {
    expand: ['items.data.price'],
  });

  return syncStripeSubscription(subscription, {
    metadata: invoice.lines?.data?.[0]?.metadata || {},
  });
}

export async function listBillingPlans() {
  return listPlanCatalogWithPricing();
}

export async function createCheckoutSession({
  userId,
  planKey,
  successUrl,
  cancelUrl,
}) {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured.');
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('A valid userId is required for billing.');
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  if (!user.emailVerifiedAt) {
    throw new Error('Verify the email address before starting checkout.');
  }

  const plan = getPlanConfig(planKey);
  const stripe = getStripeClient();
  const customerId = await ensureStripeCustomer(user);
  const urls = buildCheckoutUrls({ successUrl, cancelUrl });

  const session = await stripe.checkout.sessions.create({
    mode: plan.mode,
    customer: customerId,
    client_reference_id: user._id.toString(),
    allow_promotion_codes: true,
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    line_items: [
      {
        price: plan.priceId,
        quantity: 1,
      },
    ],
    metadata: buildSharedBillingMetadata({
      billingKind: plan.mode === 'subscription' ? 'subscription' : 'onboarding',
      planKey: plan.planKey,
      productKey: plan.productKey,
      audience: plan.audience,
      priceId: plan.priceId,
      userId: user._id.toString(),
      orgId: user._id.toString(),
    }),
    subscription_data:
      plan.mode === 'subscription'
        ? {
            metadata: buildSharedBillingMetadata({
              billingKind: 'subscription',
              planKey: plan.planKey,
              productKey: plan.productKey,
              audience: plan.audience,
              priceId: plan.priceId,
              userId: user._id.toString(),
              orgId: user._id.toString(),
            }),
          }
        : undefined,
    payment_intent_data:
      plan.mode === 'payment'
        ? {
            metadata: buildSharedBillingMetadata({
              billingKind: 'onboarding',
              planKey: plan.planKey,
              productKey: plan.productKey,
              audience: plan.audience,
              priceId: plan.priceId,
              userId: user._id.toString(),
              orgId: user._id.toString(),
            }),
          }
        : undefined,
  });

  await upsertSubscriptionRecord(
    {
      stripeCheckoutSessionId: session.id,
    },
    {
      userId: user._id,
      stripeCustomerId: customerId,
      stripeCheckoutSessionId: session.id,
      productKey: plan.productKey,
      planKey: plan.planKey,
      audience: plan.audience,
      mode: plan.mode,
      status: 'checkout_created',
      isActive: false,
      features: plan.features,
      metadata: {
        checkoutStatus: session.status,
      },
      rawStripeObject: session,
    },
  );

  return {
    sessionId: session.id,
    url: session.url,
    planKey: plan.planKey,
    mode: plan.mode,
  };
}

export async function createProviderCheckoutSession({
  providerId,
  planKey,
  planCode,
  successUrl,
  cancelUrl,
}) {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured.');
  }

  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    throw new Error('A valid providerId is required for billing.');
  }

  const provider = await ProviderModel.findById(providerId);
  if (!provider) {
    throw new Error('Provider not found.');
  }

  if (!provider.email) {
    throw new Error('Provider email is required before starting checkout.');
  }

  const resolvedPlanKey = planKey || planCode;

  if (resolvedPlanKey === 'provider_basic') {
    provider.subscription.planCode = 'provider_basic';
    provider.subscription.status = 'inactive';
    await provider.save();

    return {
      providerId,
      sessionId: null,
      url: null,
      planKey: resolvedPlanKey,
      mode: 'free',
    };
  }

  const plan = getPlanConfig(resolvedPlanKey);
  if (plan.audience !== 'provider') {
    throw new Error('Provider checkout requires a provider billing plan.');
  }

  const stripe = getStripeClient();
  let customerId = provider.subscription?.stripeCustomerId || '';
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: provider.email,
      name: provider.businessName,
      phone: provider.phone || undefined,
      metadata: {
        providerId: toObjectIdString(provider._id),
        categoryKey: provider.categoryKey,
      },
    });
    customerId = customer.id;
    provider.subscription.stripeCustomerId = customerId;
    await provider.save();
  }

  const urls = buildProviderCheckoutUrls(providerId, { successUrl, cancelUrl });

  const session = await stripe.checkout.sessions.create({
    mode: plan.mode,
    customer: customerId,
    allow_promotion_codes: true,
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    line_items: [
      {
        price: plan.priceId,
        quantity: 1,
      },
    ],
    metadata: buildSharedBillingMetadata({
      billingKind: 'subscription',
      planKey: plan.planKey,
      productKey: plan.productKey,
      audience: plan.audience,
      priceId: plan.priceId,
      orgId: toObjectIdString(provider._id),
      providerId: toObjectIdString(provider._id),
    }),
    subscription_data:
      plan.mode === 'subscription'
        ? {
            metadata: buildSharedBillingMetadata({
              billingKind: 'subscription',
              planKey: plan.planKey,
              productKey: plan.productKey,
              audience: plan.audience,
              priceId: plan.priceId,
              orgId: toObjectIdString(provider._id),
              providerId: toObjectIdString(provider._id),
            }),
          }
        : undefined,
  });

  provider.subscription.planCode = plan.planKey;
  provider.subscription.status = 'checkout_created';
  provider.subscription.stripeCheckoutSessionId = session.id;
  provider.subscription.stripePriceId = plan.priceId;
  await provider.save();

  return {
    providerId: toObjectIdString(provider._id),
    sessionId: session.id,
    url: session.url,
    planKey: plan.planKey,
    mode: plan.mode,
  };
}

export async function getBillingSummary(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('A valid userId is required.');
  }

  const user = await UserModel.findById(userId).lean();
  if (!user) {
    throw new Error('User not found.');
  }

  if (user.isBillingBypass || user.role === 'admin' || user.role === 'super_admin') {
    return {
      userId,
      isStripeConfigured: isStripeConfigured(),
      access: {
        audience: 'internal',
        planKey: 'admin_bypass',
        status: 'active',
        features: ADMIN_FEATURES,
      },
      subscription: null,
    };
  }

  if (user.isDemoAccount) {
    return {
      userId,
      isStripeConfigured: isStripeConfigured(),
      access: {
        audience: 'demo',
        planKey: 'demo_bypass',
        status: 'active',
        features: DEMO_FEATURES,
      },
      subscription: null,
    };
  }

  const activeSubscription = await BillingSubscriptionModel.findOne({
    userId,
    isActive: true,
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (!activeSubscription) {
    return buildFreeSummary(userId);
  }

  const subscription = serializeSubscription(activeSubscription);
  const features = [...new Set([...BASE_FREE_FEATURES, ...(subscription.features || [])])];

  return {
    userId,
    isStripeConfigured: isStripeConfigured(),
    access: {
      audience: subscription.audience,
      planKey: subscription.planKey,
      status: subscription.status,
      features,
    },
    subscription,
  };
}

export async function handleStripeWebhook(rawBody, signature) {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured.');
  }

  const stripe = getStripeClient();
  let event;

  if (env.STRIPE_WEBHOOK_SECRET) {
    if (!signature) {
      throw new Error('Missing Stripe-Signature header.');
    }

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } else {
    event = JSON.parse(rawBody.toString('utf8'));
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await syncCheckoutSession(event.data.object);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncStripeSubscription(event.data.object);
      break;
    case 'invoice.paid':
      await syncInvoice(event.data.object);
      break;
    default:
      break;
  }

  return {
    received: true,
    type: event.type,
  };
}
