# GK Advisory — Phase 9
## Working Capital & Cash Release Engine

Phase 9 converts the Working Capital Analyzer placeholder into a browser-based management analysis tool.

### Features
- DSO, DIO, DPO and Cash Conversion Cycle calculation
- Target KPI inputs
- Target balance calculation for receivables, inventory and payables
- Cash release opportunity analysis
- Driver-level cash impact table
- Current vs target net operating working capital
- Basic management insight / largest opportunity
- CSV export
- Responsive mobile layout
- Existing GKAuth session gate

### Core formulas
- DSO = Trade Receivables / Annual Revenue × Days
- DIO = Inventory / Annual COGS × Days
- DPO = Trade Payables / Annual COGS × Days
- CCC = DSO + DIO − DPO
- Target AR = Revenue × Target DSO / Days
- Target Inventory = COGS × Target DIO / Days
- Target AP = COGS × Target DPO / Days
- Cash release = Current AR − Target AR + Current Inventory − Target Inventory + Target AP − Current AP

### Scope note
This is a management analytics engine, not a statutory accounting conclusion. Production enhancements should include monthly/quarterly trend data, seasonality, customer-level aging, inventory segmentation, supplier terms, FX, VAT/tax effects, intercompany balances, and data lineage.
