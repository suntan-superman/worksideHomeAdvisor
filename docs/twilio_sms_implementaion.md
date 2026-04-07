Workside Home Advisor
Provider Marketplace + SMS Routing + Confirmation Loop Spec
🎯 Objective

Implement an end-to-end workflow:

Seller → Request Service → Provider Match → SMS Notification → Provider Response → Seller Confirmation → Task Update

This system must be:

Fully automated
Real-time
Scalable (thousands of providers)
Twilio-based (approved toll-free number)
🧱 System Architecture
Components
1. Mobile App (Seller)
Creates service requests
Views provider responses
Confirms selections
2. Backend (Node / Cloud Run)
Handles provider matching
Sends SMS via Twilio
Processes inbound SMS responses
Updates database state
3. Twilio
Outbound SMS
Inbound SMS webhook
Status callbacks
4. Database (MongoDB)

Collections:

providers
service_requests
provider_responses
sms_logs
🗄️ Data Models
Service Request
{
  _id: ObjectId,
  propertyId: ObjectId,
  sellerId: ObjectId,
  serviceType: "inspection" | "cleaning" | "photography" | "title",
  description: string,
  status: "pending" | "notified" | "in_progress" | "completed",
  providerIds: ObjectId[],
  selectedProviderId?: ObjectId,
  createdAt: Date
}
Provider
{
  _id: ObjectId,
  name: string,
  phone: string,
  services: string[],
  zipCodes: string[],
  rating?: number,
  active: boolean
}
Provider Response
{
  _id: ObjectId,
  requestId: ObjectId,
  providerId: ObjectId,
  response: "yes" | "no",
  message?: string,
  timestamp: Date
}
🔄 Flow Breakdown
STEP 1 — Seller Creates Request
Trigger

Mobile App → POST /api/service-request

{
  "propertyId": "...",
  "serviceType": "inspection",
  "description": "Need home inspection this week"
}
STEP 2 — Provider Matching
Backend Logic
const providers = await Provider.find({
  services: serviceType,
  zipCodes: property.zipCode,
  active: true
}).limit(5);

Save provider IDs to request.

STEP 3 — Send SMS via Twilio
Message Template
Workside Home Advisor:

New Inspection Request near Bakersfield.

Reply:
YES – to accept
NO – to decline

Job ID: {{requestId}}
Send SMS
await twilioClient.messages.create({
  body: message,
  from: process.env.TWILIO_NUMBER,
  to: provider.phone,
  statusCallback: "/twilio/sms/status"
});
STEP 4 — Inbound SMS Webhook
Endpoint
POST /twilio/sms/inbound
Twilio Payload
{
  From: "+1XXXXXXXXXX",
  Body: "YES 12345"
}
Parse Logic
const [response, requestId] = body.split(" ");

const normalized = response.toLowerCase() === "yes" ? "yes" : "no";
Save Response
await ProviderResponse.create({
  requestId,
  providerId,
  response: normalized,
  timestamp: new Date()
});
STEP 5 — Auto-Select Provider
Logic
if (response === "yes") {
  const existing = await ServiceRequest.findById(requestId);

  if (!existing.selectedProviderId) {
    existing.selectedProviderId = providerId;
    existing.status = "in_progress";
    await existing.save();
  }
}
STEP 6 — Notify Seller
SMS to Seller
"Good news! A provider has accepted your request. We’ll connect you shortly."
(Optional) Push Notification
STEP 7 — Update UI (Mobile)
Show:
Accepted provider
Status: "In Progress"
Contact info
📡 Twilio Setup
Webhooks
Inbound SMS
https://api.worksideadvisor.com/twilio/sms/inbound
Status Callback
https://api.worksideadvisor.com/twilio/sms/status
Required Env Variables
TWILIO_ACCOUNT_SID=[already set in backend env]
TWILIO_AUTH_TOKEN=[already set in backend env]
TWILIO_PHONE_NUMBER=+18889494776
🧠 Smart Enhancements (Phase 2)
1. Multi-Provider Race
Notify 3–5 providers
First YES wins
Others get:
"Request already accepted. Thank you!"
2. Timeout Logic
if (no response in 10 minutes) {
  expand provider radius
}
3. AI Routing (Future)
Score providers based on:
response speed
completion rate
ratings
4. SMS Branding
Workside Home Advisor – Mainsail Property
📊 Logging (CRITICAL)

Create sms_logs:

{
  to: string,
  body: string,
  status: string,
  requestId: ObjectId,
  createdAt: Date
}
🔐 Compliance
Only send SMS to opted-in providers
Respect STOP/HELP
Log consent timestamps
🎯 Success Criteria
Seller submits request ✅
Providers receive SMS within 2 seconds ✅
First provider response captured ✅
Seller notified automatically ✅
UI updates in real-time ✅