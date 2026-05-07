# Merxus Chat Widget Handoff

Date: 2026-05-07

## Summary

HomeAdvisor now mounts a Workside Home Advisor chat widget in the web app root layout. The widget is adapted from the Merxus web app public chat flow and talks directly to the Merxus AI backend public chat endpoints.

For richer HomeAdvisor-specific AI answers and logged-in workflow guidance, also provide the Merxus backend team with:

- [merxus-homeadvisor-product-knowledge.md](./merxus-homeadvisor-product-knowledge.md)

Implemented in HomeAdvisor:

- `apps/web/components/WebsiteChatWidget.js`
- `apps/web/lib/public-chat.js`
- `apps/web/app/layout.js`
- `apps/web/styles/globals.css`
- `.env.example`

The widget sends:

- `product: "home_advisor"`
- `tenantId: "home-advisor-platform"`
- `tenantType: "platform"`
- `source: "website_chat"`
- `sourceUrl`
- `visitorId`
- optional `leadName`, `leadEmail`, and `authenticated`

## Merxus Backend Contract

The HomeAdvisor widget uses these Merxus endpoints:

- `POST /chat/public/session`
- `POST /chat/public/session/:sessionId/messages`
- `GET /chat/public/session/:sessionId/messages`
- `POST /chat/public/session/:sessionId/request-human`
- `POST /chat/public/session/:sessionId/transcript`
- `POST /chat/public/session/:sessionId/timeout`

The current Merxus backend already appears to support the needed product key:

- `src/modules/chat/services/publicChatService.js` includes `home_advisor` in `PUBLIC_PRODUCTS`.
- `src/modules/chat/services/publicChatService.js` maps `home_advisor` to `home-advisor-platform`.
- `src/modules/support/services/supportSessionService.js` lists `home_advisor` as `Workside Home Advisor`.
- Support takeover and reply are present through `/support/sessions/:id/takeover` and `/support/sessions/:id/reply`.

## Merxus Team Items To Verify

1. Confirm CORS allows the deployed HomeAdvisor web origin to call the Merxus API.
2. Confirm production HomeAdvisor sets:

   ```env
   NEXT_PUBLIC_MERXUS_CHAT_API_URL=https://api.merxus.ai/api
   ```

3. Confirm at least one support user or department is assignable for:

   ```json
   {
     "product": "home_advisor",
     "tenantId": "home-advisor-platform"
   }
   ```

4. Confirm Workside Support Console users who should see these chats have `allowedProducts` containing either `home_advisor` or `__all__`.
5. Confirm support notification email/SMS routing is enabled for `home_advisor` so `request-human` produces an actionable queue item.
6. Confirm the support console deployed at `SUPPORT_CONSOLE_URL` can deep-link to HomeAdvisor sessions using the `product=home_advisor` filter.

## Live Transfer Path

Expected end-to-end flow:

1. Visitor opens the HomeAdvisor widget.
2. Visitor sends an AI message, creating a Merxus public chat session.
3. Visitor enters name/email if anonymous.
4. Visitor selects `Talk to a person`.
5. Widget calls `/chat/public/session/:sessionId/request-human`.
6. Merxus backend marks the session as transfer requested and notifies eligible support users.
7. Support user opens Workside Support Console, filters/selects `Workside Home Advisor`, accepts takeover.
8. Support console calls `/support/sessions/:id/takeover`.
9. Support user replies.
10. Widget polls `/messages` and displays the agent reply to the visitor.

## Notes

- No Merxus backend source change was made in this run because the reviewed backend already contains the `home_advisor` product support and live takeover/reply endpoints.
- The HomeAdvisor widget requires a valid visitor email before human request for anonymous visitors, matching the Merxus public chat behavior.
- The widget supports transcript email on manual end and idle timeout cleanup.
