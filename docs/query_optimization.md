Refactor backend data fetching layer with the following goals:

1. Eliminate duplicate queries within a single request
   - Implement request-scoped caching for:
     - mediaAssets
     - mediaVariants
     - properties
     - pricingAnalyses

2. Replace N+1 query patterns with batched queries
   - Use $in queries for mediaVariants by assetIds

3. Add projections to ALL queries
   - Only fetch required fields

4. Optimize pricingAnalyses queries
   - Ensure index on { propertyId: 1 }
   - Reduce document size via projection

5. Parallelize independent queries using Promise.all

6. Create new endpoint:
   GET /api/v1/properties/:id/full

   Should return:
   {
     property,
     mediaAssets,
     mediaVariants,
     reports,
     pricingAnalyses,
     checklist
   }

7. Remove redundant repeated calls in:
   - workflow endpoint
   - dashboard endpoint
   - media endpoint

Goal:
Reduce request latency from ~2s → <500ms