# GK Advisory — Phase 8

## DCF Finance Engine

Phase 8 turns the DCF placeholder into a working valuation prototype.

### Included
- 5-year revenue and FCF projection
- Base / Upside / Downside scenarios
- EBITDA, D&A, CAPEX and NWC assumptions
- Tax calculation
- WACC and terminal growth
- Gordon Growth terminal value
- Enterprise Value / Equity Value bridge
- Per-share value
- Terminal Value / EV diagnostic
- WACC × terminal growth sensitivity matrix
- Print / PDF-friendly output
- Client-side license gate for `dcf`

### CFO / Advisory perspective
The output is designed to surface not only valuation but also key management sensitivities. The terminal value share of EV is shown as a diagnostic because a high terminal-value contribution increases valuation sensitivity to WACC and long-term growth assumptions.

### Production roadmap
This is a finance-engine prototype, not a transaction-grade valuation report. Future iterations should add:
- explicit forecast vs management case reconciliation
- historical financial statement import
- debt schedule and cash sweep
- mid-year convention
- NOL / tax-loss treatment
- separate D&A and CAPEX schedules
- working-capital build from operational drivers
- scenario versioning and audit trail
- Excel/PDF model pack
- market-data integrations with controlled source dates
