# GK Advisory — Phase 7

## Navigation & Tool Routing Fix

- Dashboard now uses stable dedicated routes for TMS 29 and DCF.
- `tms29.html` is the actual TMS 29 engine.
- `dcf.html` is a separate DCF placeholder page; it no longer falls through to TMS 29.
- `tool.html` remains as a backwards-compatible router for legacy `?service=` links.
- Locked/unreleased tools continue to show the construction page.

## Why this change

The prior architecture used one `tool.html` endpoint for every tool. That made it possible for a missing/ignored query parameter to load the TMS 29 page for another tool. Dedicated routes eliminate that ambiguity.
