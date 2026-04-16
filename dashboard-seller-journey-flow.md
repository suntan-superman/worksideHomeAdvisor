Agent Dashboard + Seller Journey Flow

Filename: agent-dashboard-seller-journey.md

# Agent Dashboard + Seller Journey Flow
## "From First Photo → Listing-Ready → Confident Seller"

---

## 🎯 Objective

Create a unified experience that:

- Guides sellers step-by-step toward a listing-ready home
- Gives agents visibility, control, and leverage
- Turns AI outputs into actionable progress
- Drives engagement and conversion

---

## 🧠 Core Principle

> Show progress, not features.

Users should feel:
- “I’m improving my home”
- not
- “I’m using a bunch of tools”

---

# 👤 USER ROLES

## Seller
- uploads photos
- sees improvements
- follows recommendations

## Agent
- monitors progress
- guides seller
- prepares listing assets

---

# 🔄 FULL JOURNEY FLOW

Seller Uploads Photo
First Impression (Instant Win)
Smart Enhancement (Visible Improvement)
Readiness Score Update
Recommendations + Tasks
Iteration Loop
Listing-Ready Output
Agent Final Review
Export + Publish

---

# 🏗️ SELLER EXPERIENCE

---

## 📸 Step 1: Upload

### UI:


Upload Photo →
Instant Processing →


---

## ⚡ Step 2: First Impression

### Output:

- before/after slider
- immediate improvement

### Messaging:

> "Your photo has been enhanced to improve first impressions."

---

## 📊 Step 3: Readiness Score

```json id="seller-score"
{
  "score": 68,
  "delta": +4
}
UI:
Listing Readiness: 68/100
↑ +4 improvement
🧠 Step 4: Recommendations
Example:
Top Improvements:
1. Remove clutter from surfaces
2. Improve lighting
3. Consider lighter wall tones
✅ Step 5: Task System

Each recommendation becomes a task:

{
  id: "declutter_living_room",
  status: "pending",
  impact: "high"
}
UI:
[ ] Declutter surfaces
[ ] Improve lighting
[ ] Test wall colors
🔁 Step 6: Iteration Loop

User can:

apply enhancement
upload new photo
mark task complete
📈 Step 7: Progress Feedback

Every action updates:

readiness score
visual improvements
task completion
UX:

“You’re getting closer to listing-ready.”

🏁 Step 8: Listing-Ready Output
Output:
final enhanced image
confidence score
improvements summary
🧑‍💼 AGENT DASHBOARD
📊 Dashboard Overview
Layout:
-------------------------------------
| Seller | Score | Status | Action |
-------------------------------------
| Smith  | 72    | In Progress | View |
| Jones  | 88    | Ready       | Review |
-------------------------------------
📈 Key Metrics
average readiness score
listings ready this week
seller progress rate
👁️ Seller Detail View
Shows:
uploaded images
before/after comparisons
readiness score history
task completion
UI:
[ IMAGE COMPARISON ]

Score: 68 → 74

Tasks:
✔ Declutter
⬜ Lighting
⬜ Staging
🧠 Agent Actions

Agents can:

approve listing-ready images
suggest improvements
send feedback to seller
Example:
{
  message: "Great progress — recommend improving lighting before listing.",
  priority: "medium"
}
📤 Export Tools

Agent can:

download listing-ready images
export full listing package
generate marketing-ready assets
🔁 COLLABORATION LOOP
Seller → Agent
uploads images
completes tasks
Agent → Seller
reviews progress
provides guidance
Loop:
Seller improves →
Agent reviews →
Seller refines →
Agent approves →
Listing ready
🧠 READINESS ENGINE
Score Components
score =
  100
  - clutterPenalty
  - lightingPenalty
  - stagingPenalty
  - outdatedFinishPenalty
Dynamic Updates
every improvement → score increases
visible feedback loop
🏷️ STATUS STATES
Seller Status
Status	Meaning
Not Started	No uploads
In Progress	Improvements ongoing
Near Ready	Score > 80
Listing Ready	Score > 85
Agent Status
Status	Action
Review Needed	Agent review required
Approved	Ready to publish
🎯 KEY UX MOMENTS
1. Instant Win

User uploads → sees improvement immediately

2. Visible Progress

Score increases → motivation increases

3. Clear Next Steps

No confusion — always know what to do next

4. Agent Validation

Final confidence before listing

🚀 DIFFERENTIATION VS ZILLOW
Zillow:
static listing display
no improvement guidance
no readiness tracking
Your Platform:
dynamic improvement system
guided seller journey
agent collaboration
readiness scoring
🧠 PRODUCT POSITIONING

“We don’t just list your home — we help you prepare it to sell better.”

⚡ PERFORMANCE TARGETS
Metric	Target
Time to first value	< 2 sec
Engagement rate	High
Task completion rate	Increasing
Listing-ready conversion	High
🔗 SYSTEM INTEGRATION
First Impression →
Smart Enhancement →
Seller Tasks →
Agent Dashboard →
Listing Ready →
Export
🎯 FINAL PRINCIPLE

Guide the seller to a better listing — don’t just generate images.

✅ Result
Higher seller confidence
Strong agent value
Clear workflow
Product differentiation

End of Spec