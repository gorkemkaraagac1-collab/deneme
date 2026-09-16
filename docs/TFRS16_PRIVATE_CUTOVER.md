# TFRS16 private calculation cutover

## 2026-09-15 karar ve öncelik

Public `js/tfrs16-engine.js` kalıcı olarak kaldırılacak. Public Pages ağacında
yalnızca UI, kimlik doğrulama ve private API istemci/facade kodu kalabilir;
TFRS16 hesaplama motoru, TMS29 ve değişiklik hesapları yalnızca
`leaseqant-backend` içindeki private engine'den üretilecektir. Kullanıcının
eski yedeği yalnızca karşılaştırma kaynağıdır; public ağaca geri alınmayacak.

Bu kapı kapanana kadar yeni release özelliği açılmayacak. Önce UI-only ayrımı,
private yazma kalıcılığı ve temiz-cache canlı doğrulaması tamamlanacak; sonra
motor script etiketi ve dosyası aynı geri alınabilir PR'da kaldırılacak.

The production page uses the private calculation API as its primary source for
authenticated sessions. API-primary is now a hard privacy boundary: a missing
private result fails closed instead of silently invoking the public calculation
implementation. The remaining public engine bundle is a temporary structural
compatibility layer and is scheduled for removal; it is not a supported
calculation source.

## Why the public engine is still present

The calculation wrapper is private-gated, but the following public UI areas
still contain synchronous call sites that must be replaced with UI-only result
readers before the file can be removed:

- payment schedule and reporting-date accrual views;
- KPI and detail panels;
- accounting center, journal preview and exports;
- reassessment and contract modification flows;
- early payment, sale-and-leaseback and sublease views;
- TMS29/inflation adjustment and audit/footnote helpers;
- compatibility exports and the remaining legacy UI helpers in this bundle.

The adapter now supports the authenticated `/api/calculations/lease/batch`
endpoint and automatically splits portfolios into groups of 20. This removes
any user-facing contract-count limit while the backend keeps each request
bounded; the current hydration path uses it when available and falls back to
single requests during a rolling deployment.

Removing the file before these consumers use a UI-only private result reader
would turn the affected screens into blank or partially rendered production
pages.

## Consumer inventory (2026-09-15)

The current source-level scan has **25 production reads** through
`getPrivateCalculationForConsumer`. The old 60/36 figure described the bundle
before the self-test, rollback and dead TMS29 cleanup; it is no longer the
current inventory. All 25 reads are private-gated in API-primary mode, and the
source gate reports zero direct production calls to the raw engine. The
remaining work is structural: extract the UI-only functions from this bundle,
prove every screen still reads the private envelope, and then remove the public
implementation. The current rows are maintained in
`docs/TFRS16_PRIVATE_CONSUMER_INVENTORY.md`.

## Release gate

The exact 25-row production inventory is maintained in
`docs/TFRS16_PRIVATE_CONSUMER_INVENTORY.md`. The inventory is regenerated from
the engine source when the migration slice changes; it is the checklist for
the remaining structural extraction and screen-level smoke evidence.

Every frontend pull request and `main` push runs:

```text
node scripts/check-tfrs16-cutover.js
```

The gate verifies the API adapter and script order, the API-primary flag with
no URL override, the private-cache-first wrapper, shadow comparator presence,
Pages artifact boundary, and the absence of a TMS19 dependency in `tfrs16.html`.

The gate is deliberately source-level and dependency-free so it also runs in
the public Pages checks without exposing backend code or secrets.

## Special-flow cutover slice (2026-09-14)

TMS 29 preview, sale-and-leaseback, and sublease views now fail closed in
API-primary mode. They render only the versioned private result envelope;
when that envelope is unavailable they show an explicit unavailable state
instead of invoking the browser calculation implementation. The local
calculation path is not an accepted fallback; a missing private result remains
an explicit error until the UI-only split is complete.

This closes three of the remaining production fallback paths. Modification
and reassessment previews, journal construction, and the legacy compatibility
exports remain in the structural extraction inventory below; the public engine
must stay in place until those consumers have equivalent private result
readers and the clean-cache/rollback smoke evidence is recorded.

The apply step is now private-gated as well: API-primary calls the authenticated
modification/reassessment apply endpoints and merges their applied event,
contract patch and refreshed schedule before persisting the contract. A live
apply smoke is still required before the public engine can be removed.

## Private-only schedule source slice (2026-09-16)

`resolveContractScheduleSource()` now fails closed when an applied modification
or reassessment does not carry the versioned private event-aware envelope. The
previous browser-side schedule fallback is no longer reachable from report,
classification and control consumers. The control schedule, modification
control and reassessment control all read the resolved private schedule and
surface an unavailable/error state when the backend result is incomplete.

The source gate is **120/120** with zero direct production calls to the raw
engine. The fallback builder functions remain as an isolated removal candidate
until the final production-reference scan proves that no compatibility helper
still needs them; this slice deliberately does not delete the public bundle.

## Classification private-source slice (2026-09-16)

Reporting-date current/non-current classification now consumes the same
`resolveContractScheduleSource()` result as the payment plan and control views.
An applied modification or reassessment therefore cannot silently re-enter the
browser reassessment builder; if the private event-aware envelope is incomplete,
classification returns an explicit unavailable result for the UI to surface.

The public gate now checks this boundary in addition to the schedule source
boundary. The public engine remains in place while the remaining compatibility
helpers and live mutation flows are retired in later slices.

## Removal criteria

The public engine may be removed in a separate, reversible pull request only
after all of the following are true:

1. Payment plan, KPI, reports, journals/exports, modifications,
   reassessments, TMS29 and sublease/sale-and-leaseback views consume the
   private result envelope or a dedicated private view endpoint.
2. The API-primary e2e flow covers a full multi-period schedule and every
   detail tab used in production.
3. A previous Pages artifact is recorded as the rollback target. Rollback is a
   deployment/artifact action; a browser `?api=0` local-calculation path is
   not part of the target architecture.
4. A clean-cache live smoke test passes for an admin account and a normal user.

TMS19 is independent of this gate and remains private/frozen until the TFRS16
release decision.
