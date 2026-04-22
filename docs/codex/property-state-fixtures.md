# Property State Fixtures

## Added test coverage
`apps/api/src/modules/documents/output-class-engine.test.js` includes fixtures for:
1. low readiness + no ready photos + no chosen price
2. mid readiness + some ready photos + chosen price
3. near launch + strong gallery + chosen price
4. sparse data edge case
5. high readiness + weak gallery mismatch

## Validated outputs
- selected output classes
- section registry behavior
- tone profile mapping
- action depth profile mapping
