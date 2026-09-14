# TFRS16 private facade

`js/private-tfrs16-facade.js` is the small browser boundary between the UI and
the authenticated private calculation adapter. It contains no calculation
logic and does not expose the proprietary engine.

## Current slice

- `load(contract)` delegates one calculation to the private API.
- `loadMany(contracts)` delegates the bounded batch adapter; portfolios larger
  than 20 are split by `private-calculation-api.js`.
- `project(result)` returns the stable read-only result fields that summary and
  payment-plan renderers consume.
- `tfrs16-engine.js` uses the facade when it is present and retains the same
  single-request fallback for a rolling deploy or a temporary API failure.

## First consumer migration

- The **Ödeme Planı** tab requests the private result on demand when opened,
  including the case where portfolio warm-up has not finished yet.
- An in-flight request is shared per contract and invalidated with the normal
  calculation cache, so edits cannot reuse a stale read-only result.
- If the private request fails, the existing CFO/local schedule path remains
  available as the rollback-safe fallback.

## Summary and report read-only consumers

- Opening a contract detail now requests the private result on demand when the
  portfolio warm-up has not finished yet.
- The existing summary cards and synchronous report/journal readers are
  redrawn from that same private result envelope when it arrives; the active
  detail tab is preserved.
- A failed request leaves the already rendered local result in place and marks
  the contract for the normal local-fallback path. No public engine code is
  removed in this slice.

## Modification and reassessment consumers

- Successful create, update, apply and cancel operations invalidate the local
  calculation cache and warm the updated contract through the private API
  before the host view is redrawn.
- A private refresh failure still redraws the existing local fallback, so a
  temporary API or deployment issue does not block the user's workflow.
- This keeps modification and reassessment on the same private result envelope
  as the summary and payment-plan consumers.

This package is intentionally behavior-preserving. It establishes the seam for
moving read-only detail, report, journal, modification and sublease consumers
one group at a time. The public engine remains in the Pages artifact until each
consumer group has a private result contract and a rollback smoke.
