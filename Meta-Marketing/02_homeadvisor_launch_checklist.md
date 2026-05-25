# HomeAdvisor Meta Launch Checklist

## Implemented In This Pass

- Meta Pixel bootstrap added in `apps/web/app/layout.js`.
- Pixel is controlled by `NEXT_PUBLIC_META_PIXEL_ID` in `.env.example`.
- Public live-transfer capture added at `apps/api/src/modules/public/public.routes.js`.
- Support transfer persistence lives in `apps/api/src/modules/support/support-transfer.service.js`.
- Existing model used: `apps/api/src/modules/support/support-transfer.model.js`.
- Admin support transfer API added at `/api/v1/admin/support/live-transfers`.
- Chat widget now records HomeAdvisor-side handoff context from `apps/web/components/WebsiteChatWidget.js`.
- Admin email alert added through `sendSupportLiveTransferAlert` in `apps/api/src/services/emailService.js`.
- Seller and agent copy pack added in `Meta-Marketing/01_homeadvisor_meta_ad_copy.md`.

## Launch Validation

1. Set `NEXT_PUBLIC_META_PIXEL_ID` to the production Meta Pixel ID.
2. Build and deploy the web app so the pixel appears on `/`, `/sell`, `/agents`, `/privacy`, and `/terms`.
3. Open Meta Events Manager and confirm PageView fires on `merxusllc.com` or the production domain used for HomeAdvisor traffic.
4. Submit the seller landing page email gate and confirm `public_funnel_events` receives the capture event.
5. Open the website chat, enter name/email, click "Talk to a person," and confirm:
   - Merxus receives `/chat/public/session/:sessionId/request-human`.
   - HomeAdvisor receives `/api/v1/public/support/live-transfer`.
   - A row exists in `support_live_transfer_requests`.
   - Admin alert email is sent or console-captured depending on `EMAIL_PROVIDER`.
6. Confirm `/privacy` and `/terms` are visible from landing and SMS consent pages.

## Remaining Operational Risks

- Pixel cannot be verified until a real Meta Pixel ID is configured in the production environment.
- Email alerts depend on `EMAIL_PROVIDER`, `ADMIN_ALERT_EMAIL`, and SendGrid/SMTP credentials.
- The HomeAdvisor support record is created after Merxus accepts the human request. If Merxus is unavailable, the visitor sees the chat error and no live-transfer record is created.
- Admin UI does not yet display `/api/v1/admin/support/live-transfers`; the API and email path are in place.
