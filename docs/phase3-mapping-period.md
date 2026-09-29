# Phase 3 — Used account-mapping evidence and shared journal period

Status: implementation ready; live acceptance BLOCKED until merge/deployment. Backend tenant enforcement and ADMIN period lock acceptance remain BLOCKED without an isolated DB/test identities. UI tests are not backend security certification.

## Live reproduction — 29 September 2026

Test / ACCOUNTANT_MANAGER; Financial Intelligence Platform; common period August 2026. The accounting centre opened January 2025. Account mapping showed editable local defaults (e.g. 260.01.001) and contradictory help claiming those defaults were used. No local mapping saved or reset, no financial posting performed.

## Changes

- v2 mapping screen reads authenticated, integrity-checked journal authority packages for the selected company/common period. Displays the accounts actually used by each period voucher with mapping ID, version/hash and journal source ID. This is a used-account view, not the complete approved chart of accounts. There is no full mapping-management DTO/UI in this change.
- v2 no longer offers ineffective local editing or reset. Legacy renderer, local data and public APIs remain available unchanged outside v2; no local mapping is transferred to authoritative vouchers.
- Contract detail and accounting centre initialize from the common period. Bulk modal initializes from the same source. Explicit year/month/period/custom date choices are retained in memory per contract or bulk scope when reopened.
- Period changes clear stale previews. Bulk in-flight requests are invalidated before export; single previews check that the original controls still belong to the requested period before rendering. Late account-source responses cannot overwrite a new company selection.
- No ledger/ERP posting, mapping changes or period-lock changes are enabled. Backend remains unchanged.

## Verification

7/7 focused UI tests, including custom period retention, company mismatch rejection, delayed response isolation and in-flight bulk invalidation. Synthetic DTOs exercise presentation/integrity only and do not certify accounting values.

Full frontend suite: 98 tests, 93 pass, 5 existing environment failures requiring disposable DB or numeric authority proofs. Public boundary PASS, zero private leakage. Cutover PASS, 185 assertions. Syntax and diff checks passed.

## Outstanding acceptance

After merge: verify used TEST-* mapping/version evidence and common August period in detail, accounting centre and bulk modal; verify explicit choices survive reopen. Full server mapping management, isolated backend unauthorized/tenant tests and ADMIN close/reopen acceptance remain unresolved. Phase 1 canonical term and calendar/persistence parity remain open.
