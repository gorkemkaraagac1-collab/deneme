# TFRS16 private facade

## Kaldırma hedefi (2026-09-15)

Facade, geçici bir API-primary köprüsü olarak değil, public UI'nin tek hesaplama
kapısı olarak kullanılacaktır. Public `tfrs16-ui.js` kaldırılmadan önce
facade şu iki işi de tamamlamalıdır: tüm salt-okuma sonuçlarını sunmak ve TMS29
taslak/uygulama yazmalarının private backend'de kalıcı olmasını sağlamak.

`js/private-tfrs16-facade.js` is the small browser boundary between the UI and
the authenticated private calculation adapter. It contains no calculation
logic and does not expose the proprietary engine.

## Current slice

- `load(contract)` delegates one calculation to the private API.
- `loadMany(contracts)` delegates the bounded batch adapter; portfolios larger
  than 20 are split by `private-calculation-api.js`.
- `project(result)` returns the stable read-only result fields that summary and
  payment-plan renderers consume.
- `tfrs16-ui.js` uses the facade when it is present. API-primary is a hard
  boundary: a missing result is shown as loading/unavailable until the private
  endpoint responds; it never reactivates the public calculation implementation.

## First consumer migration

- The **Ödeme Planı** tab requests the private result on demand when opened,
  including the case where portfolio warm-up has not finished yet.
- An in-flight request is shared per contract and invalidated with the normal
  calculation cache, so edits cannot reuse a stale read-only result.
- If the private request fails, the UI shows an explicit unavailable state and
  records the contract error for retry; it does not switch to browser
  calculation.

## Summary and report read-only consumers

- Opening a contract detail now requests the private result on demand when the
  portfolio warm-up has not finished yet.
- The existing summary cards and synchronous report/journal readers are
  redrawn from that same private result envelope when it arrives; the active
  detail tab is preserved.
- A failed request leaves an explicit unavailable state and records the
  contract error for retry. No public engine code is removed in this slice.

## Modification and reassessment consumers

- Successful create, update, apply and cancel operations invalidate the local
  calculation cache and warm the updated contract through the private API
  before the host view is redrawn.
- A private refresh failure shows a clear retryable error; it does not silently
  switch to a browser calculation path.
- This keeps modification and reassessment on the same private result envelope
  as the summary and payment-plan consumers.

## Private apply envelope

- `applyModification(contract, modificationId)` and
  `applyReassessment(contract, reassessmentId)` now call authenticated private
  endpoints and receive the authoritative `APPLIED` event, contract field
  patch, journal lines and refreshed schedule.
- The browser merges that envelope, persists the returned event through the
  existing contract write, and refreshes its private calculation cache. The
  input draft is never mutated by the server response.
- The local apply implementation and the `?api=0` rollback path have been
  removed; the public engine removal gate stays closed until a live apply smoke
  has passed.

This package is intentionally behavior-preserving. It establishes the seam for
moving read-only detail, report, journal, modification and sublease consumers
one group at a time. The public engine remains in the Pages artifact until each
consumer group has a private result contract and a rollback smoke.
