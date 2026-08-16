# GK Advisory — Phase 6

## TMS 29 Finance Engine

Phase 6 introduces the first working finance tool in the GK Advisory platform.

### Capabilities
- Reporting date and reporting index parameters
- Line-item input for account, description, amount, transaction date and transaction index
- Monetary / non-monetary classification
- Indexation coefficient calculation
- Adjusted amount and indexation difference
- Missing-data exception detection
- Summary metrics
- CSV export
- Browser print / PDF workflow
- TMS 29 tool entitlement check through the Phase 5 auth prototype

### Formula
Adjusted amount = historical amount × (reporting index / transaction index)

This is an educational/prototype calculation engine, not a complete TMS 29 financial statement restatement engine. Production implementation should add IAS 29/TMS 29-specific period logic, equity and P&L mechanics, opening balances, comparative periods, tax/deferred tax, cash-flow statement treatment, validation rules and a server-side audit trail.
