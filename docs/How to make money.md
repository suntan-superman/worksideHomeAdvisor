🧠 1. Two Revenue Tracks (Keep Them Separate)
🧍 Seller (Low friction / optional revenue)
Goal: acquisition + virality
NOT your main revenue driver
Recommended:
Free tier (limited)
$29–$79 one-time unlock OR light subscription
🧑‍💼 Realtor (Primary revenue engine)
Goal: monthly recurring revenue
This is where you scale
Recommended:
$49–$199/month per agent
Team pricing later
🔥 2. Stripe Product Structure (Do THIS)
Products in Stripe:
1. workside-home-advisor-seller
one-time OR subscription
simple pricing
2. workside-home-advisor-agent

👉 THIS is your core

Pricing tiers:

Starter: $49/mo
Pro: $99/mo
Team: $199/mo
3. (Later) workside-merxus-bundle

👉 Combine both platforms

🧱 3. Architecture (Matches Your Stack)

You already use:

Firebase Auth ✅
Backend API (Cloud Run likely) ✅
MongoDB ✅
Stripe Flow (Clean + Scalable)
Step 1 — Create Checkout Session

Backend:

const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [
    {
      price: STRIPE_PRICE_ID,
      quantity: 1,
    },
  ],
  success_url: `${BASE_URL}/success`,
  cancel_url: `${BASE_URL}/cancel`,
  customer_email: user.email,
});
Step 2 — Webhook (CRITICAL)

👉 This is where most apps break. You already know this, but for this product it’s essential.

Handle:

checkout.session.completed
invoice.paid
customer.subscription.updated
customer.subscription.deleted
Step 3 — Store in MongoDB
{
  "userId": "...",
  "stripeCustomerId": "...",
  "subscriptionId": "...",
  "plan": "agent_pro",
  "status": "active",
  "currentPeriodEnd": "...",
  "createdAt": "..."
}
🧠 4. Feature Gating (THIS IS KEY)

Don’t just “lock the app” — gate value moments.

🧍 Seller Gating

Free:

1 property
limited pricing
basic insights

Paid:

full pricing analysis
flyer generation
export
🧑‍💼 Realtor Gating

Free trial:

1–2 properties
full feature preview

Paid:

unlimited properties
branding
presentation mode
flyer exports
client-ready reports
🚀 5. The SMART Move (Do This Early)
💡 “Generate Flyer” = Paywall Trigger

This is your money button.

User flow:

User builds property
Gets pricing
Sees improvements
Clicks:

👉 “Generate Flyer”

→ Trigger Stripe checkout

🔥 6. Realtor Hook (VERY IMPORTANT)

For agents:

👉 Don’t sell “features”

Sell:

“Win more listings”

Your Stripe copy should say:

Plan Name:

Agent Pro

Description:

Generate pricing, comps, and listing presentations in minutes. Impress sellers and win more listings.

🔗 7. Merxus Bundle (Future Goldmine)

Later:

Bundle pricing:
Home Advisor: $99
Merxus AI: $99

👉 Bundle:
$149/month

🧠 Why this is powerful:
Listing → inbound calls → follow-up
You control the full pipeline
⚠️ 8. Apple / Mobile Consideration (Important)

Since you’ve dealt with this before:

👉 DO NOT process payments inside iOS app for this

Instead:
redirect to web checkout (Stripe)
return to app

You already mentioned doing this → good

🧱 9. Recommended Collections (Mongo)

Add:

subscriptions
{
  "_id": "...",
  "userId": "...",
  "plan": "agent_pro",
  "status": "active",
  "stripeCustomerId": "...",
  "stripeSubscriptionId": "...",
  "currentPeriodEnd": "...",
  "createdAt": "..."
}
usageTracking (optional but powerful)
{
  "userId": "...",
  "propertiesCreated": 3,
  "flyersGenerated": 2,
  "pricingRuns": 5
}
🎯 10. What I’d Do If I Were You (Direct Advice)
Right now:
1. Implement:
Stripe subscription (agent plan)
webhook → Mongo sync
feature gating
2. Tie paywall to:

👉 Flyer generation + export

3. Add:

👉 “Start free trial (7 days)”