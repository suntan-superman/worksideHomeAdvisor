# Workside Pass 1 Validation Runbook

Last updated: 2026-04-07

This runbook is for the current launch-flow validation pass while web and mobile deployment testing continues.

Use this document as the live QA checklist for the seller-facing account and property workflows that changed recently.

---

## 1. Web Forgot-Password Flow

Goal: confirm request -> verify -> reset works end to end on the live web app.

Steps:

1. Open the web auth page.
2. Start the forgot-password flow with a known seller account email.
3. Confirm the request step returns a success message without exposing whether the email exists.
4. Retrieve the OTP from the configured email inbox.
5. Enter the OTP on the verify step.
6. Set a new password and complete reset.
7. Sign in with the new password.
8. Confirm the old password no longer works.

Expected results:

- Request succeeds without leaking account existence.
- OTP verification advances to the reset step.
- Reset completes and returns the user to a valid signed-in session.
- The new password works immediately.

Record:

- Environment:
- Account used:
- Result:
- Notes/issues:

---

## 2. Mobile Forgot-Password Flow

Goal: confirm the same request -> verify -> reset flow works inside the mobile app.

Steps:

1. Open mobile auth.
2. Start forgot-password with a known seller account.
3. Request the reset OTP.
4. Retrieve the OTP from email.
5. Verify the OTP in mobile.
6. Set a new password.
7. Sign in again with the new password.

Expected results:

- Mobile follows the same state transitions as web.
- Reset completes without UI dead-ends.
- The new password works on the next sign-in attempt.

Record:

- Device:
- App build:
- Account used:
- Result:
- Notes/issues:

---

## 3. Seller Contact Settings Save / Reload

Goal: confirm seller first name, last name, mobile phone, and SMS opt-in persist correctly.

Steps:

1. Sign in on web and open the dashboard.
2. Change first name, last name, and mobile phone.
3. Toggle SMS opt-in on with a valid mobile number.
4. Save contact settings.
5. Refresh the dashboard page.
6. Confirm the updated values reload correctly.
7. Toggle SMS opt-in off and save again.
8. Refresh once more and confirm the disabled state persists.

Expected results:

- Save returns a success toast.
- Reload shows the latest values.
- SMS-enabled state and phone formatting remain consistent after refresh.
- Disabling SMS clears the enabled state without corrupting the mobile number.

Record:

- Account used:
- Result:
- Notes/issues:

---

## 4. Web Photo Source And Notes Persistence

Goal: confirm uploaded web photos retain source, notes, and listing-note metadata.

Steps:

1. Open a property workspace on web.
2. Upload at least one photo using `Web upload`.
3. Add import notes during upload.
4. After the asset is saved, add or edit the listing note in the photo review area.
5. Refresh the workspace.
6. Confirm the same asset still shows:
   - correct source
   - import notes
   - listing note

Expected results:

- The uploaded asset appears immediately.
- Source shows as `web_upload`.
- Upload notes persist after refresh.
- Listing note persists after refresh and is visible anywhere the asset summary is reused.

Record:

- Property:
- Assets tested:
- Result:
- Notes/issues:

---

## 5. Mobile Photo Source Persistence

Goal: confirm mobile capture/library uploads retain their source values.

Steps:

1. Open a property in mobile.
2. Upload one photo from capture and one from library if both flows are available.
3. Refresh the property media view or reopen the property.
4. Open the same property on web if needed to inspect the stored asset metadata indirectly.

Expected results:

- `mobile_capture` assets remain distinguishable from `mobile_library`.
- Assets remain attached to the same property after reload.

Record:

- Device:
- Property:
- Source paths tested:
- Result:
- Notes/issues:

---

## 6. Freeform Enhancement Validation

Goal: confirm natural-language enhancement requests create usable jobs and return a result or warning cleanly.

Suggested prompts:

- `Please remove small clutter, brighten the room, and keep it realistic.`
- `Please remove furniture, change flooring to dark hardwood, and brighten the room while keeping it realistic.`
- `Change walls to warm white and make the room feel cleaner without changing the layout.`

Steps:

1. Open the Vision tab for a property photo.
2. Enter one of the prompts above into the freeform enhancement box.
3. Generate the custom enhancement.
4. Confirm the job completes and returns either:
   - a generated variant, or
   - a clear warning/error state
5. Review the produced variant for realism and metadata quality.
6. Refresh and confirm the generated result remains visible in the variant gallery.

Expected results:

- The request is accepted and processed without UI dead-end states.
- The generated job is stored as `freeform`.
- The variant shows a sensible summary/warning.
- The result remains attached to the correct photo after refresh.

Record:

- Property/photo:
- Prompt used:
- Result:
- Realism concerns:
- Notes/issues:

---

## 7. Social-Pack Generation Validation

Goal: confirm social-pack generation works against live property data and selected media.

Steps:

1. Open a property with pricing and at least a few photos.
2. Generate or refresh the social pack.
3. Confirm the latest pack appears in the workspace.
4. Review:
   - headline
   - primary text
   - short caption
   - CTA
   - selected photos
   - markdown/export content if surfaced
5. Refresh the property and confirm the latest pack still loads.

Expected results:

- Generation succeeds without missing-data crashes.
- Selected photos come from the strongest current assets.
- Marketing copy and CTA look coherent with the property.
- The latest pack remains available after refresh.

Record:

- Property:
- Result:
- Copy quality notes:
- Photo selection notes:
- Issues:

---

## 8. Suggested Order For Live Testing

Run the checks in this order:

1. Web forgot-password
2. Mobile forgot-password
3. Seller contact settings
4. Web photo source + notes
5. Mobile photo source
6. Freeform enhancement
7. Social-pack generation

This order keeps account recovery first, then seller-profile persistence, then media and premium-output validation.
