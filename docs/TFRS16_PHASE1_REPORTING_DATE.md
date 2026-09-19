# TFRS 16 Phase 1 — reporting date and liability classification

Phase 1 routes reporting-date classification through the authenticated private
engine boundary. The public runtime keeps only a date-keyed cache and result
projection for presentation consumers.

## Private boundary

`POST /api/calculations/lease/reporting-date` returns the narrow envelope used
by the UI: reporting date, total/outstanding liability, current and
non-current liability, ROU carrying amount, and the next-twelve-month payment,
principal, and interest totals. The response does not expose engine objects,
traces, or intermediate calculation state.

## Public consumers

`js/tfrs16-reporting-date-cache.js` delegates to the existing private facade,
deduplicates concurrent requests, and preloads the active reporting date during
backend hydration. KPI and financial-reporting flows warm their selected date
before rendering. In API-primary mode `calculateLiabilitySplitAsOf` reads only
the private envelope and fails closed with
`PRIVATE_REPORTING_DATE_NOT_READY` when that envelope is unavailable.

## Verification

- Backend private API contract tests cover the envelope, reconciliation, and
  invalid-date validation.
- Full backend Jest suite: 24 suites, 291 tests passed.
- Golden regression suite: 26 tests passed, 1 intentionally skipped.
- Public cutover gate: 159 checks passed.

Phase 2 (TMS 21 / FX translation) must not begin until the reporting-date
consumer smoke flows are confirmed against the deployed private endpoint.
