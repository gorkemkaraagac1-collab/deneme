# Phase 1 — authoritative payment-plan UI (draft, not release acceptance)

## Ne bulundu

On 2026-09-29, the approved noncustomer Test session was inspected read-only through the normal contract-detail UI. The payment tab received server reporting rows, but a parallel legacy table initializer still called the deliberately disabled presentation converter and emitted REPORTING_AUTHORITY_UNAVAILABLE. The tab also mixed the initial-recognition preview with an unformatted technical schedule. The v2 header inferred duration from inclusive calendar months, while its standards panel inferred TMS 29 from currency alone.

## Ne değişti

- Only UI v2 routes payment-table initialization to the existing reporting authority consumer. No converter is re-enabled.
- The real payment-plan panel displays scheduleRows from the accepted reporting event, with Turkish dates/numbers, no financial aggregation/conversion, and explicit missing-source cells.
- The initial-recognition journal retains its existing independent authority and has a separate heading.
- The v2 duration header requests canonical source evidence instead of inventing a duration from dates or payment count. A canonical duration is still required before this finding can close.
- The v2 standards panel shows the reported route/period and requests approved TMS 29 period evidence. It does not infer applicability from TRY.
- Legacy DOM, script order, GK_TFRS16 public API, index/logo and financial engine are unchanged. The legacy detail initializer is intentionally outside this v2 patch.

## Test sonucu

Main baseline: bccdbc60e277fd8cebd805d5c36f8026fd32238f. No open frontend PR was returned at inspection time.

Using Node 24 and temporary npm jsdom 26 dependencies, the same full-suite command was run against an archived clean main and the working branch:

- Baseline: 85 tests, 80 passed, 5 failed.
- Changed branch: 87 tests, 82 passed, the same 5 failed; no new unexplained failures.
- After the final badge-removal correction: all 6 contract-view tests passed, including normal detail-tab interaction, exact source-date/value presentation, missing/unsupported source, separate journal preservation, and v2 delegation before any old converter access.
- Public boundary gate: PASS, 0 private leakage.
- Cutover gate: PASS, 185 source assertions.
- git diff --check: PASS.

The five existing environment failures are not successful accounting verification:

| Test | Missing prerequisite |
|---|---|
| authority-rc1-export.test.js | /tmp/authority-rc1-numeric.json |
| authority-rc1.browser.test.js | Disposable local database |
| journal-authority.test.js | /tmp/journal-auth-r1-numeric.json |
| reporting-authority.browser.test.js | Disposable local database |
| reporting-authority.test.js | /tmp/report-auth-r1-numeric.json |

## Riskler / kalan kanıt

- Initial connector access to the private backend returned 404; subsequently authorized repository access restored source inspection. The current reporting DTO has no canonical duration field. Canonical PostgreSQL DATE, live server revision parity and independent persisted-date evidence remain unavailable; the observed 27/28 distinction is not closed. Dates were not shifted to hide it.
- No server DTO extension or accounting-policy change was invented. Canonical duration and approved standards evidence remain required.
- No merge or deployment was performed. Published changes have not been tested at desktop/mobile widths or through live legacy regression. Local tests are not live acceptance.
- No customer data, credentials, raw source packages, or Test financial values are committed here. No save/import/apply/lock/posting action was performed.
- The live session was returned to General Overview. No browser width/filter was modified.

FAZ 1 — BLOCKED — canonical backend date/duration evidence, isolated backend prerequisites, and post-deployment live acceptance are outstanding. Do not start Phase 2.

## 2026-09-29 — post-merge acceptance and remaining observer defect

PR #518 was merged at 441e3f45c87c2bc3eba8c11793fe645587e637e9. The Pages deployment and published policy/lint/check workflows for that commit completed successfully. A fresh authenticated read-only session opened the contract through the normal menu and selected the payment tab. The formatted server schedule and explicit duration-source message were observed live. The legacy standards badge nevertheless reappeared above the new detail panel.

Root cause: v26HookContractDetail observes the whole document and recreates the removed currency-derived panel after v2 rendering. Removing the initial node alone was insufficient. The corrective change prevents registration of this legacy observer in UI v2; legacy retains its original observer. A jsdom regression covers initial rendering, subsequent DOM changes and legacy reinsertion.

Validation for the correction: 7/7 detail tests; full suite 83 passed with the same 5 missing-environment failures; public boundary PASS; cutover 185 assertions PASS. The correction requires its own PR and publication before live badge acceptance. Canonical duration, persisted-date evidence and the remaining Phase 1 acceptance checks are still open. No Phase 2 work, accounting-policy change or live posting was performed.
