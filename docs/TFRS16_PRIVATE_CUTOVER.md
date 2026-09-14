# TFRS16 private calculation cutover

The production page uses the private calculation API as its primary source for
authenticated sessions. The local `js/tfrs16-engine.js` file remains in the
Pages artifact as a compatibility fallback while the rest of the TFRS16 view
stack is migrated.

## Why the public engine is still present

The calculation wrapper is already private-first, but the following public UI
areas still read the engine result synchronously or use engine helpers directly:

- payment schedule and reporting-date accrual views;
- KPI and detail panels;
- accounting center, journal preview and exports;
- reassessment and contract modification flows;
- early payment, sale-and-leaseback and sublease views;
- TMS29/inflation adjustment and audit/footnote helpers;
- built-in self-tests and compatibility exports.

The adapter now supports the authenticated `/api/calculations/lease/batch`
endpoint and automatically splits portfolios into groups of 20. This removes
any user-facing contract-count limit while the backend keeps each request
bounded; the current hydration path uses it when available and falls back to
single requests during a rolling deployment.

Removing the file before these consumers use the private result envelope would
turn a calculation fallback into a blank or partially rendered production page.

## Release gate

Every frontend pull request and `main` push runs:

```text
node scripts/check-tfrs16-cutover.js
```

The gate verifies the API adapter and script order, the API-primary flag and
`?api=0` rollback, the private-cache-first wrapper, shadow comparator presence,
Pages artifact boundary, and the absence of a TMS19 dependency in `tfrs16.html`.

The gate is deliberately source-level and dependency-free so it also runs in
the public Pages checks without exposing backend code or secrets.

## Removal criteria

The public engine may be removed in a separate, reversible pull request only
after all of the following are true:

1. Payment plan, KPI, reports, journals/exports, modifications,
   reassessments, TMS29 and sublease/sale-and-leaseback views consume the
   private result envelope or a dedicated private view endpoint.
2. The API-primary e2e flow covers a full multi-period schedule and every
   detail tab used in production.
3. The rollback flow (`?api=0`) is green and a previous Pages artifact is
   recorded as the rollback target.
4. A clean-cache live smoke test passes for an admin account and a normal user.

TMS19 is independent of this gate and remains private/frozen until the TFRS16
release decision.
