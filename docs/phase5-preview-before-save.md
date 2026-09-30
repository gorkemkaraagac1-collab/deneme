# Phase 5 — Sale-and-leaseback preview before form persistence

Status: BLOCKED for full Phase 5 acceptance. This PR delivers a bounded v2 ordering and stale-preview fix. No live financial write or event application was performed.

## Finding and change

The existing sale-and-leaseback detail handler persisted the form before calling the private calculation endpoint. A rejected calculation could therefore leave saved economic inputs without a successful preview.

Under html[data-lq-ui="2"], the existing calculation button now requests a read-only server calculation. A separate initially disabled save button persists only the captured inputs of a successful preview. Input/change events clear the result and invalidate the preview; an input or contract snapshot change without an event is checked again at response and save time. Sequence and DOM connectivity checks reject delayed responses after edits or contract navigation. During persistence the form controls are disabled, duplicate saves are ignored, failure restores the previous contract value, and a fresh preview is required after either outcome.

The legacy binder/markup and financial calculation endpoints remain unchanged. No browser financial calculation, policy, new support route, ledger posting or journal generation was introduced. The save action continues to save the existing form; it is not an accounting-event apply approval. Existing element IDs and script order are preserved.

## Source/support findings and limits

The inspected local backend exposes modification, reassessment and sale-and-leaseback calculations. These accept client contract snapshots and enforce calculation tenant scope; they do not produce a preview bound to a persisted contract/event revision. The v2 form explicitly discloses this limit. A frontend input fingerprint is only an invalidation check, not an authority or authorization token.

Sublease still obtains its special-flow result after existing form persistence; no dedicated trusted proposed-event preview route was found. This PR does not change that flow or claim its acceptance. Modification/reassessment impact panels, trusted preview/apply economic identity, period-lock presentation, isolated ADMIN/non-ADMIN and tenant negative tests, and consolidation/elimination support evidence remain open. No new accounting engine or policy is supplied.

## Validation

Fresh main baseline at 9dc949b: 110 tests, 105 pass, five failures requiring unavailable disposable DB/numeric authority fixtures. After change: 115 tests, 110 pass, the same five failures. Five new tests exercise the actual detail runtime with mocked server boundaries: preview without writes, exact captured inputs on explicit save, late-response rejection, input/contract revision invalidation, preview/save failure, duplicate save and detached form safety. Existing operation/legacy navigation tests pass. Public authority boundary PASS with zero private leakage; cutover gate PASS with 185 assertions. JavaScript syntax and git diff checks pass.

Live read-only preview acceptance awaits merge/deployment. Save/apply and ADMIN lock acceptance require a separately authorized isolated test environment. No Phase 5 PASS claim.
