# Phase 5 — Server period-lock presentation

Status: BLOCKED — this PR connects existing read-only lock status; live verification awaits merge/deployment. Full operation preview and isolated authorization acceptance remain incomplete.

## Finding

On published frontend 99f94ac, the actual Kapanış menu showed a verified calculation package but always displayed “Sunucu durumu gerekli” for the period lock. The UI never queried the existing lock-status source. This was reproduced read-only on the selected approved test company and August reporting period. The session header showed guest/unverified identity, so no user-role assurance is inferred from it.

Current private backend main 166913f retains GET /api/periods/lock-status, authenticated and scoped by the existing access service. Its route and service are unchanged from the inspected checkout. This source reads persisted lock state; there is no frontend or backend write in this PR. Source-code presence does not prove the production backend revision or runtime security behavior.

## Change

The existing authenticated request adapter adds a GET-only call with exact companyId and periodKey. OPEN/LOCKED, identity and lockedAt are validated; malformed, denied, absent and failed responses cannot be accepted as OPEN.

Only v2 Kapanış/Kontroller connects the source. The selected dates must describe exactly one full calendar month before a monthly lock is requested. Custom or multi-month ranges explicitly require a full month rather than assuming a lock from the end date. The panel distinguishes loading, OPEN, LOCKED, unsupported range and unavailable source. Company and date edits clear prior state; request epochs and connected-output checks reject late responses. No long-lived status cache is used. Raporu getir reads fresh state.

Kilitli contributes only to the lock step in the existing close summary. Açık remains pending. A lock does not certify disclosures, posting readiness, user role or mutation authorization. No close/reopen controls are introduced. Legacy report presentation, DOM IDs, script order, public API and accounting engine remain unchanged.

## Validation

Fresh baseline on 99f94ac: 115 tests, 110 pass, five failures requiring unavailable disposable DB/numeric authority fixtures. Final suite: 120 tests, 115 pass, the same five environment failures. Five new presentation/request tests cover matching OPEN/LOCKED, wrong company/month/status, source denial, stale company/date response, custom range, actual legacy report loading and authenticated GET/no mutation. Synthetic reporting packages exercise UI validation only; they are not accounting or live security evidence.

Public authority boundary PASS with zero private leakage; cutover PASS with 185 source assertions. JavaScript syntax and diff checks pass. No backend code, financial inputs, contract/event records, locks, policies, production posting or ERP records were changed.

## Remaining acceptance

After merge, verify the actual Kapanış menu against deployed lock status and period/company changes. Production source/version availability, actual role verification, isolated ADMIN close/reopen and unauthorized tenant rejection remain unproven. Mobile width acceptance is also outstanding. If the endpoint fails or is absent in production, the UI must retain unavailable status. Full Phase 5 remains BLOCKED.

Earlier PR #527 live validation confirmed separate preview/save and invalidation behavior, but its successful preview remains blocked by the server assessment prerequisite. No form was saved and no event was applied.
