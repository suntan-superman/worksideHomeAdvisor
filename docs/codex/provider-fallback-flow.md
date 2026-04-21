# Provider Fallback Flow

Provider recommendation generation now follows:

1. Query curated marketplace providers by category.
2. If curated providers exist, prefer curated match.
3. If curated providers are missing, use nearby discovery fallback (`externalItems`) from existing Google fallback flow.
4. Only emit a true empty state when both curated and fallback sources return no providers.

Output fields added to provider recommendations:

- `sourceType` (`marketplace`, `nearby_discovery`)
- `sourceLabel`
- `reasonMatched`
- `confidenceNote`
- `mapsUrl` (when available)
- `websiteUrl` (when available)

Report rendering now labels provider source and avoids the old "No providers matched yet" dead-end phrasing.

