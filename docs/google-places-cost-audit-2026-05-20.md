# Google Places Cost Audit - 2026-05-20

## Goal

Reduce Google Places API spend by at least 80% while preserving the seller-facing provider discovery experience.

## Production Text Search Usage

### Text Search (New)

- File: `apps/api/src/modules/providers/providers.service.js`
- Function: `requestGoogleFallbackPlaces`
- Endpoint: `https://places.googleapis.com/v1/places:searchText`
- Field mask:
  - `places.id`
  - `places.displayName`
  - `places.formattedAddress`
  - `places.googleMapsUri`
  - `places.websiteUri`
  - `places.nationalPhoneNumber`
  - `places.rating`
  - `places.userRatingCount`
  - `places.primaryTypeDisplayName`

### Legacy Text Search

- File: `apps/api/src/modules/providers/providers.service.js`
- Function: `requestGoogleLegacyTextSearch`
- Endpoint: `https://maps.googleapis.com/maps/api/place/textsearch/json`
- Status after audit: disabled by default with `GOOGLE_PLACES_ENABLE_LEGACY_TEXTSEARCH=false`.

## Execution Frequency Before Fix

Before this pass, `listProvidersForProperty` triggered Google fallback when either:

- no curated providers were found, or
- the caller explicitly set `includeExternal=true`.

That meant ordinary page loads could become billable Google searches whenever marketplace coverage was missing.

Observed call paths:

- Property workspace provider recommendations:
  - `apps/web/app/properties/[propertyId]/PropertyWorkspaceClient.js`
  - `refreshProviders(...)` runs from a `useEffect` on property/task changes.
  - No debounce.
  - Before fix, no internal providers could automatically call Places.
- Dashboard provider highlights:
  - `apps/web/app/dashboard/page.js`
  - React Query runs when a selected property and provider support task exist.
  - `staleTime` was only 20 seconds.
  - Before fix, no internal providers could automatically call Places.
- Provider map:
  - `apps/web/components/PropertyLocationMap.js`
  - Fetches `/provider-map` when the map mounts or scope/filters change.
  - Can request external providers only when `includeExternal=true`, currently tied to the "all" map scope.
- Report generation:
  - `apps/api/src/modules/documents/report.service.js`
  - Previously requested `includeExternal=true` for photographer, cleaning, and staging recommendations.
  - This could create up to three external provider discovery searches per generated report.
- Manual Google fallback browse:
  - `apps/web/app/properties/[propertyId]/PropertyWorkspaceClient.js`
  - `handleBrowseGoogleFallback()` explicitly calls `includeExternal=true`.
  - This remains the main intended billable path.

## Debounce Behavior

There is no debounce around provider fallback calls. These are not keystroke-driven searches, so debounce is less important than preventing automatic background execution. The cost fix is to make Places calls explicit, capped, and cached.

## Caching Behavior Before Fix

- ZIP coordinate cache existed.
- Address geocode cache existed, but property coordinate lookup bypassed it in one path.
- Places Text Search fallback results were not cached.
- Dashboard React Query had a short 20 second client stale time, but backend Google calls could still happen across users, sessions, and server instances.

## Rerender And Repeat-Request Risk

No infinite rerender loop was found.

Repeat-request risks were:

- React Strict Mode/dev remounts can duplicate the workspace provider effect.
- Dashboard provider highlights can refetch after stale time or selection changes.
- Map image fetching refires when map scope or filters change.
- Report generation could call three categories in parallel.

The key issue was not an infinite loop. It was that passive UI/server paths could trigger Google fallback when marketplace data was empty.

## Changes Implemented

- `listProvidersForProperty` now calls Google fallback only when `includeExternal=true`.
- Places fallback has a 24 hour in-memory cache by property/category/limit.
- Text Search (New) attempts are capped to one query by default.
- Legacy Text Search is disabled by default.
- Report generation no longer uses Google fallback unless `GOOGLE_PLACES_ENABLE_REPORT_FALLBACK=true`.
- Property coordinate lookup now reuses the existing address geocode cache.
- Env knobs added:
  - `GOOGLE_PLACES_FALLBACK_CACHE_TTL_MS=86400000`
  - `GOOGLE_PLACES_FALLBACK_MAX_TEXT_SEARCH_ATTEMPTS=1`
  - `GOOGLE_PLACES_ENABLE_LEGACY_TEXTSEARCH=false`
  - `GOOGLE_PLACES_ENABLE_REPORT_FALLBACK=false`

## Expected Cost Reduction

Passive usage reduction should be 90-100% for pages that previously triggered Google fallback because there were no curated providers.

Explicit fallback usage reduction should still be substantial:

- Before: one empty provider category could attempt many query variants against Text Search (New), then repeat against legacy Text Search.
- After: one Text Search (New) request by default, cached for 24 hours for the same property/category/limit.

This meets the 80% reduction goal under normal marketplace browsing and report generation behavior.

## Autocomplete Opportunities

Autocomplete is not a drop-in replacement for automated provider discovery because the current feature asks "find nearby providers for this category" rather than "complete this user-entered business query."

Good Autocomplete use cases:

- Manual "add provider by business name" search.
- Admin/provider onboarding business lookup.
- Seller-selected provider lookup after the seller starts typing.

Recommended future implementation:

- Add a user-initiated provider search box.
- Use Places Autocomplete with session tokens while typing.
- Call Place Details only after the user selects a prediction.
- Store the selected provider as a curated or saved provider so future displays do not call Places.

## Remaining Tasks

- Add persistent provider fallback storage if Google fallback results should survive API restarts and Cloud Run instance churn.
- Add per-property/category rate limiting for explicit Google fallback clicks.
- Add analytics counters for:
  - fallback requested
  - fallback cache hit
  - Text Search (New) request count
  - legacy fallback request count
  - report fallback request count
- Build the Autocomplete-backed manual provider add/search flow.
- Review Google Cloud billing after deployment to confirm Text Search request volume dropped as expected.
