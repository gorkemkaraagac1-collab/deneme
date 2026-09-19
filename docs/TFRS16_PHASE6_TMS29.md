# TFRS 16 Phase 6 — TMS 29 private boundary

The public TFRS 16 runtime treats TMS 29 as a private API result. Single
contract previews and journal flows use the private facade, while footnotes,
reports, exports, and portfolio views use the bounded private batch loader.

The browser renders and persists the returned restatement and journal envelope
without rebuilding inflation ratios, ROU layers, liability restatement, or
journal lines. If the private endpoint is unavailable, the UI fails closed and
does not fall back to a public TMS 29 implementation.
