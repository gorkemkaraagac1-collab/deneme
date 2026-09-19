# TFRS 16 Phase 3 — early payment

Early-payment input validation and persistence remain in the public UI, while
the private engine owns the liability snapshot, periodic-rate treatment, and
revised schedule. `applyEarlyPayment` calls the authenticated private facade,
stores the returned event and schedule, then invalidates the affected private
cache entry.

The cutover gate checks that the public mutation wrapper contains no periodic
rate or revised-schedule reconstruction. A missing private endpoint is an
explicit error and never activates a browser calculation fallback.
