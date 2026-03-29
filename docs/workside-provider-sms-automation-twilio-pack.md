# Workside Home Advisor
## Provider SMS Automation + Twilio Templates Pack
### Codex-Ready Messaging Flows, Webhooks, and Template Library

Last Updated: 2026-03-29

---

# 1. Purpose

This document defines the provider-side SMS automation system for Workside Home Advisor.

It includes:
- Twilio-based provider lead routing flows
- outbound SMS event design
- inbound reply handling
- template library for providers
- recommended webhook structure
- status transitions
- operational safeguards
- Codex implementation checklist

This pack is designed to make the provider marketplace feel immediate, responsive, and low-friction from day one.

---

# 2. Product Goal

Providers should feel:

“I can start receiving real opportunities immediately, and I can respond in seconds.”

Sellers and agents should feel:

“The platform is actively helping me move the sale forward.”

SMS is the fastest way to create that feeling early.

---

# 3. Core Principles

1. SMS should be simple
2. One lead should never blast too many providers
3. Replies must be easy to parse
4. Messages should be short and clear
5. Every SMS should map to a real backend state transition
6. STOP/HELP handling must be respected
7. Provider SMS should work even if the provider never opens a portal

---

# 4. Recommended SMS System Architecture

## 4.1 Core Components

```text
apps/api/src/modules/marketplace-sms/
  marketplace-sms.service.ts
  marketplace-sms.controller.ts
  twilio-signature.service.ts
  provider-reply-parser.service.ts
  lead-routing.service.ts
  provider-notification.service.ts
```

## 4.2 Key Objects Used
- providers
- leadRequests
- leadDispatches
- providerResponses
- providerAnalytics

## 4.3 Twilio Integration Points
- outbound SMS sending via Twilio REST API
- inbound SMS webhook for YES/NO/HELP/STOP and freeform replies
- optional delivery status callback later

---

# 5. Lead Routing SMS Flow

## 5.1 Outbound Sequence

When a lead request is created:
1. rank providers
2. select top 3
3. create leadDispatches
4. send outbound SMS
5. wait for replies
6. update providerResponses
7. surface accepted/declined status in app/admin

## 5.2 Recommended Timing
- initial SMS: immediately
- reminder SMS: optional after 30–60 min if no response
- route next provider: if all three decline or no one responds within configured window

---

# 6. Inbound Reply Rules

## 6.1 Accepted Short Replies
- YES
- Y
- ACCEPT

## 6.2 Decline Short Replies
- NO
- N
- DECLINE

## 6.3 Help Replies
- HELP

## 6.4 Opt-Out Replies
- STOP
- STOPALL
- UNSUBSCRIBE
- CANCEL
- END
- QUIT

## 6.5 Freeform Replies
If provider sends freeform text:
- store raw text
- attempt lightweight classification:
  - accept
  - decline
  - question
- if unclear, mark as manual_review or custom_reply

---

# 7. Status Model

## 7.1 leadRequests.status
- open
- routing
- matched
- completed
- expired
- cancelled

## 7.2 leadDispatches.status
- queued
- sent
- delivered
- accepted
- declined
- expired
- failed

## 7.3 providerResponses.responseStatus
- accepted
- declined
- help
- opted_out
- custom_reply
- no_response

---

# 8. Twilio Webhook Design

## 8.1 Inbound Webhook
```http
POST /marketplace/twilio/inbound
```

### Responsibilities
- verify Twilio signature
- parse From
- parse Body
- resolve provider by phone
- find latest pending dispatch for provider
- classify response
- update dispatch / providerResponse / leadRequest
- optionally send follow-up SMS
- log event

## 8.2 Optional Status Callback Later
```http
POST /marketplace/twilio/status
```

Can be used for:
- delivered
- failed
- undelivered

---

# 9. Provider SMS Template Pack

# 9.1 New Lead: Inspection

```text
New Workside lead: Home inspection request near {{zip}}. Reply YES to accept or NO to decline.
```

Example:
```text
New Workside lead: Home inspection request near 93312. Reply YES to accept or NO to decline.
```

---

# 9.2 New Lead: Title Company

```text
New Workside lead: Title services request near {{zip}}. Reply YES to accept or NO to decline.
```

---

# 9.3 New Lead: Photographer

```text
New Workside lead: Real estate photo request near {{zip}}. Reply YES to accept or NO to decline.
```

---

# 9.4 New Lead: Cleaning / Staging

```text
New Workside lead: Home prep request near {{zip}}. Reply YES to accept or NO to decline.
```

---

# 9.5 Accepted Confirmation

Send after provider accepts:

```text
Thanks — you’ve accepted this Workside lead. We’ll mark you as engaged for this request.
```

Optional richer version later:
```text
Thanks — you’ve accepted this Workside lead. Property area: {{zip}}. We’ll mark you as engaged for this request.
```

---

# 9.6 Declined Confirmation

```text
No problem — we’ve marked this Workside lead as declined. You’ll continue receiving future eligible requests unless you opt out.
```

---

# 9.7 Help Response

```text
Workside provider SMS: Reply YES to accept a lead, NO to decline, STOP to opt out. For support, contact support@worksidesoftware.com.
```

Replace support contact as needed.

---

# 9.8 Opt-Out Confirmation

```text
You’ve been opted out of Workside provider SMS notifications. Reply START to re-enable messages later if supported.
```

---

# 9.9 Reminder Message (Optional)

Send only if:
- dispatch still pending
- reminder enabled
- provider has not replied

```text
Reminder: Workside lead still available near {{zip}}. Reply YES to accept or NO to decline.
```

---

# 9.10 Provider Invite SMS

Use when manually onboarding providers:

```text
Hi {{name}}, Workside is onboarding a small number of local {{categoryLabel}} providers for homeowner leads in {{city}}. Interested? Reply YES and we’ll send your signup link.
```

---

# 9.11 Provider Signup Link SMS

```text
Thanks! Complete your Workside provider profile here: {{signupUrl}}
```

---

# 9.12 Welcome Provider SMS

After onboarding/payment:

```text
Welcome to Workside. Your provider profile is now active and eligible for local leads. We’ll text you when a matching request comes in.
```

---

# 10. Recommended Messaging Style Rules

- keep under 160 characters when possible
- no fluff
- one clear CTA
- category + location must be obvious
- never include too much seller detail in SMS
- do not include full property address in first SMS
- protect seller privacy

---

# 11. Seller Privacy Rules

Do not send providers:
- seller full name in first message
- full address in first message
- detailed property notes in SMS
- exact phone/email unless workflow later permits it

Safe early SMS:
- category
- area ZIP
- general request type

Deeper details can be exposed only after provider accepts and product rules allow it.

---

# 12. Provider Reply Parsing Logic

## 12.1 Normalize Reply
- trim whitespace
- uppercase
- remove punctuation where useful

## 12.2 Parser Behavior
Pseudo logic:

```ts
if body in ["YES", "Y", "ACCEPT"] => accepted
if body in ["NO", "N", "DECLINE"] => declined
if body in ["HELP"] => help
if body in STOP_WORDS => opted_out
else => custom_reply
```

## 12.3 Custom Replies
Examples:
- “Can you send more details?”
- “What type of property?”
- “Available tomorrow”

Store raw body and mark for later workflow handling.

---

# 13. Suggested Backend Contract

## 13.1 Outbound Send Function

```ts
type SendProviderLeadSmsInput = {
  providerId: string;
  leadRequestId: string;
  categoryKey: string;
  zip: string;
  templateKey: string;
};
```

## 13.2 Inbound Parsed Result

```ts
type ParsedProviderReply =
  | { status: "accepted" }
  | { status: "declined" }
  | { status: "help" }
  | { status: "opted_out" }
  | { status: "custom_reply"; rawBody: string };
```

---

# 14. Example Inbound Webhook Handler Flow

1. verify Twilio signature
2. read From, Body
3. find provider by phone
4. find latest pending leadDispatch for provider
5. parse body
6. update providerResponses
7. update leadDispatch status
8. if accepted:
   - mark accepted
   - optionally stop further routing
   - send confirmation SMS
9. if declined:
   - mark declined
   - optionally queue next provider
   - send decline confirmation
10. if help:
   - send help response
11. if opted_out:
   - mark provider SMS opt-out flag
   - send opt-out confirmation

---

# 15. Recommended Data Fields for SMS Operations

## On providers
```json
{
  "leadRouting": {
    "deliveryMode": "sms_and_email",
    "notifyPhone": "555-111-2222",
    "notifyEmail": "owner@example.com",
    "smsOptOut": false
  }
}
```

## On leadDispatches
```json
{
  "deliveryChannels": ["sms"],
  "smsMessageSid": "SMxxxxxxxx",
  "smsSentAt": "2026-03-29T00:05:00.000Z",
  "responseStatus": null
}
```

---

# 16. Twilio Content / Compliance Notes

## 16.1 Provider SMS Consent
Providers should consent during onboarding.

Suggested checkbox language:
- I agree to receive Workside provider SMS notifications about lead opportunities. Msg frequency varies. Msg/data rates may apply. Reply STOP to opt out.

## 16.2 STOP / HELP
Respect standard STOP/HELP behavior.
Twilio already supports common opt-out patterns, but backend should still track provider opt-out state.

## 16.3 Do Not Re-Message Opted-Out Providers
Before sending any SMS:
- check provider.leadRouting.smsOptOut !== true

---

# 17. Lead Routing Business Rules

## 17.1 Initial Routing
- send to top 3 providers only
- skip suspended/inactive/opted-out providers
- skip providers outside coverage area

## 17.2 Acceptance Rule
If one provider accepts:
- keep lead open or mark matched depending on product rule
- optionally continue accepting more providers if you want seller choice
- recommended early default: allow up to 2 accepted providers max

## 17.3 Expiration
If no provider accepts within window:
- leadRequest.status = expired
- optionally show fallback providers from Google / external sources

---

# 18. Admin Dashboard Requirements for SMS

Admin should see:
- outbound SMS sent count
- failed SMS
- opt-outs
- response times
- accepted vs declined
- open pending dispatches

Admin actions:
- resend lead SMS
- manually route to next provider
- pause provider SMS
- update provider phone
- mark provider as opted back in later if supported

---

# 19. Codex Implementation Checklist

## Core SMS
- [ ] create marketplace-sms module
- [ ] create outbound SMS sender service
- [ ] create inbound webhook endpoint
- [ ] verify Twilio signature
- [ ] create provider reply parser
- [ ] update dispatch + response records
- [ ] send confirmation/decline/help/opt-out messages

## Provider State
- [ ] add smsOptOut flag to provider
- [ ] block sends to opted-out providers
- [ ] allow HELP response handling
- [ ] store raw inbound message logs

## Lead Routing
- [ ] integrate SMS sends into lead dispatch creation
- [ ] add reminder logic (optional)
- [ ] add next-provider routing logic on decline/timeout
- [ ] cap number of providers contacted

## Admin / Ops
- [ ] surface SMS metrics in admin
- [ ] add resend tool
- [ ] add failed message visibility
- [ ] add opt-out visibility

---

# 20. Recommended Rollout Order

## Phase 1
- outbound lead SMS
- inbound YES/NO parsing
- acceptance/decline updates
- confirmation SMS
- opt-out tracking

## Phase 2
- HELP handling
- reminder messages
- provider invite SMS
- onboarding link SMS

## Phase 3
- richer provider portal + SMS hybrid
- status callbacks
- smarter routing logic
- provider performance analytics

---

# 21. Final Direction to Codex

Build provider SMS automation to feel:
- immediate
- low-friction
- reliable
- human-readable
- operationally simple

Do not overcomplicate the first version with long message trees.

The winning behavior is:
- provider gets text
- provider replies YES
- system updates instantly
- seller/admin sees movement

That is how the marketplace starts to feel real.

---

End of Document
