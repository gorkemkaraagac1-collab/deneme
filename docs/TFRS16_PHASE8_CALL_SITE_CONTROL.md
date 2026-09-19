# TFRS 16 Phase 8 — call-site and dead-code control

Phase 8 records the repository-wide check applied after the public cleanup.
The release gate scans every public JavaScript runtime file and the page HTML
for removed lease-math helper calls, inline handlers, and stale `api=0` or
local-engine fallback wording. The scan also covers the private adapter,
facade, result bridge, reporting, operations, and FX UI modules.

The remaining `calculateLease` and `calculateLeaseEngine` names are bridge
compatibility entry points; their implementations delegate to private results.
Reporting, journal, export, dashboard, and control consumers are checked for
private cache/facade paths before legacy code is removed. Historical design
notes remain documentation and are excluded from the runtime call-site scan.
