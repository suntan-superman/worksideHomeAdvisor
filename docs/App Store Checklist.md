CRITICAL (don’t skip these)
1. Account Deletion (Apple WILL check this)

You said it works — good. Now make sure:

Apple requirements:
Must be inside the app
Must fully delete account + data
Not just “deactivate”
What Apple reviewers WILL do:
Tap Settings
Look for delete option
Try it
You need:
“Delete Account” (in your Danger Zone)
Confirmation modal
Final confirmation screen

👉 If deletion requires backend processing:

show success message
optionally send confirmation email
2. Demo Account (HIGHLY recommended)

Right now you’re using:

demo@worksideadvisor.com

👉 Add this to App Store Connect:

App Review Notes:

You can log in using:

Email: demo@worksideadvisor.com
Password: [your password]

This account has a fully populated property with pricing, photos, and tasks.

⚠️ Without this → high chance of rejection

3. “Loading your properties…” message

From your screenshots:

“Signed in successfully. Loading your properties…”

👉 This MUST NOT persist.

Fix:

show as toast
auto-dismiss after 2–3 seconds
or remove entirely

👉 Apple hates “unfinished feeling” UI

4. Network dependency disclosure

Your app:

depends on backend (Cloud Run)
requires login

👉 In review notes, add:

This app requires an internet connection to load property data and generate reports.
⚠️ VERY LIKELY REJECTION RISKS
5. Empty states

Example:

“No providers matched yet”

👉 This is OK, but:

You MUST:

make it look intentional
not broken

Better:

No providers yet — we’ll suggest local services when needed.
6. Placeholder / system text

In your reports you had:

“rows will appear here…”
fallback messages

👉 Ensure NONE of this shows in production

7. Pricing / valuation language

You are giving:

price ranges
recommendations

Apple concern:
👉 “financial advice” / “misleading claims”

Fix:
Add subtle disclaimer (in-app or report footer):

Estimates are based on available market data and should not be considered formal appraisals.
🧠 app.json review (you’re mostly good)

Your config is clean — just a few improvements:

8. Add description metadata (important)

Right now missing:

description
keywords

Not in app.json, but in App Store Connect:

Suggested:

Name:
Workside Home Advisor

Subtitle:
Prepare, price, and launch your home

Keywords:
real estate, home selling, pricing, listing prep, comps, home advisor

9. Versioning strategy

You’re at:

"version": "1.0.0"

👉 Good for first release.

But also ensure:

iOS build number increments (EAS handles this)
10. Icons (you’re good 👍)

You set:

icon: ./assets/icon_1024.png

👉 That matches App Store requirements

🟢 NICE-TO-HAVE (but not required)
11. Add onboarding hint (optional but helpful)

Apple reviewers appreciate clarity.

Add a small first-run hint:

“Select a property to begin”
12. Add “Contact Support” tap action

You show:

support@worksideadvisor.com

👉 Make it tappable (mailto:)
