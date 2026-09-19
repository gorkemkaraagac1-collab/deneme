# TFRS 16 migration — public Phase 0 inventory

Public `main` baseline: `edee2f29b08e07853aafd7397d9439893a95e478`.
Accounting calculations belong to the private backend. Public files retain
input collection, authenticated API calls, private-result cache reads, and
presentation (tables, reports, journals, exports, and filters).

The private boundary is maintained by `private-calculation-api.js`,
`private-tfrs16-facade.js`, `tfrs16-private-result-bridge.js`, and the
fail-closed cache coordinator. The source-level cutover gate in
`scripts/check-tfrs16-cutover.js` is the repository-wide reference check.

Phase endpoints consumed by the adapter are:

- `/api/calculations/lease`
- `/api/calculations/lease/batch`
- `/api/calculations/lease/reporting-date`
- `/api/calculations/lease/tms21`
- `/api/calculations/lease/tms29` and `/tms29/batch`
- `/api/calculations/lease/early-payment`
- `/api/calculations/lease/sale-and-leaseback`
- `/api/calculations/lease/modification` and `/reassessment` (preview/apply)

No browser fallback is permitted when a private result is missing. The golden
fixture matrix and immutable baseline live in the private backend test tree;
the public cutover gate verifies that the public bundle does not expose the
private engine asset or direct production calls to its raw implementation.
