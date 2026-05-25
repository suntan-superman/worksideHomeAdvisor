# Workside Home Advisor Meta Ad Copy

Scope: seller and real-estate-agent campaigns for Facebook/Instagram. Copy is written to support the live `/sell` and `/agents` funnels, the installed website chat widget in `apps/web/components/WebsiteChatWidget.js`, the legal pages at `/privacy` and `/terms`, and the new HomeAdvisor support transfer record at `/api/v1/public/support/live-transfer`.

## Campaign Positioning

Workside Home Advisor is not a generic home-value form. It is a guided pre-listing workspace that connects pricing, prep tasks, photo readiness, provider help, reports, and marketing outputs into one seller-to-market plan.

Core differentiators to use against competitors:

- Competitors: capture a lead, show a generic estimate, or sell the seller to an agent network.
- Workside: gives the homeowner or agent a working plan with pricing context, preparation priorities, photo feedback, provider routing, and polished outputs.
- Competitors: stop at advice.
- Workside: moves from diagnosis to execution with checklist tasks, provider support, reports, flyers, and human handoff.

## Seller Ads

### Seller A: Before You List

Primary text:
Before you list your home, know what is helping the sale and what is quietly hurting it. Workside Home Advisor gives sellers a pricing range, prep priorities, photo guidance, provider support, and a clear plan to get market-ready.

Headline:
Prep Your Home Before You List

Description:
Pricing, photos, tasks, and provider help in one guided seller plan.

On-image copy:
Do not guess your pre-listing plan.

CTA:
Get Started

Best landing URL:
`/sell?src=meta&medium=paid_social&campaign=seller_prelisting_plan&adset=home_sellers&ad=seller_a_before_you_list`

### Seller B: The Hidden Cost Of Guessing

Primary text:
Most sellers do not need another vague estimate. They need to know which repairs matter, which photos need work, what price story the market supports, and who can help finish the prep. Workside turns the selling process into a step-by-step plan.

Headline:
Turn Selling Prep Into A Plan

Description:
Get a clearer path from address to market-ready.

On-image copy:
Pricing. Prep. Photos. Providers.

CTA:
Learn More

Best landing URL:
`/sell?src=meta&medium=paid_social&campaign=seller_guided_prep&adset=home_sellers&ad=seller_b_hidden_cost`

### Seller C: Human Help When It Matters

Primary text:
AI can organize the selling prep. A real person can still help when the question gets specific. Workside Home Advisor combines guided AI planning, seller reports, provider support, and live handoff when you need follow-up.

Headline:
AI Guidance With Human Follow-Up

Description:
Start online, then ask for help from the chat when needed.

On-image copy:
AI plan. Human handoff.

CTA:
Start Seller Plan

Best landing URL:
`/sell?src=meta&medium=paid_social&campaign=seller_human_handoff&adset=home_sellers&ad=seller_c_handoff`

## Agent Ads

### Agent A: Win The Listing Conversation

Primary text:
Walk into the seller conversation with more than a CMA. Workside helps agents build a prep plan, pricing narrative, photo-readiness review, provider support path, and seller-facing reports before the listing goes live.

Headline:
Give Sellers A Better Listing Plan

Description:
Prep, pricing, reports, and marketing outputs for agents.

On-image copy:
More than a CMA.

CTA:
Sign Up

Best landing URL:
`/agents?src=meta&medium=paid_social&campaign=agent_listing_plan&adset=listing_agents&ad=agent_a_win_listing`

### Agent B: Repeatable Listing Prep

Primary text:
Every listing has the same messy middle: price, prep, photos, vendors, reports, and seller decisions. Workside gives agents a repeatable workspace to manage that process across active properties.

Headline:
Listing Prep, Systemized

Description:
A guided workspace for agent-led seller prep.

On-image copy:
From seller meeting to market-ready.

CTA:
Get Agent Access

Best landing URL:
`/agents?src=meta&medium=paid_social&campaign=agent_repeatable_workflow&adset=listing_agents&ad=agent_b_systemized`

### Agent C: Professional Seller Outputs

Primary text:
Sellers remember clarity. Workside helps agents produce cleaner pricing summaries, prep guidance, photo feedback, reports, flyers, and provider recommendations so every listing feels professionally managed from day one.

Headline:
Look Prepared Before You List

Description:
Seller-facing reports and workflow tools built for listing prep.

On-image copy:
Reports sellers can understand.

CTA:
Learn More

Best landing URL:
`/agents?src=meta&medium=paid_social&campaign=agent_seller_outputs&adset=listing_agents&ad=agent_c_outputs`

## Retargeting Copy

Primary text:
Still deciding how to prep the home? Workside Home Advisor helps organize the next move: price story, task priorities, listing photos, local provider support, and a clear route back to your workspace.

Headline:
Pick Up Your Seller Plan

Description:
Return to pricing, prep, photos, and reports.

CTA:
Continue

Best landing URL:
`/sell?src=meta&medium=paid_social&campaign=retarget_seller_plan&adset=site_visitors&ad=retarget_continue`

## Compliance And Launch Notes

- Avoid guaranteed sale-price, appraisal, ROI, or time-to-sell claims.
- Use "pricing guidance" and "pricing context," not "official valuation" or "appraisal."
- Send seller traffic to `/sell`; send agent traffic to `/agents`.
- Make sure Meta events are tested after `NEXT_PUBLIC_META_PIXEL_ID` is configured.
- Verify `/privacy`, `/terms`, and the chat "Talk to a person" path before launch.
