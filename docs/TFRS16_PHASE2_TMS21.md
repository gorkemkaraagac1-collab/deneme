# TFRS 16 Phase 2 — TMS 21 / FX translation

TMS 21 lease translation now has one production path: the authenticated
private calculation endpoint. `buildTms21FxTranslation` derives a strict
calendar reporting date and delegates to `LeaseQantPrivateTfrs16Facade`;
public code formats the returned schedule and journal envelope only.

The unreachable browser translation implementation was removed after all
call-sites were verified. The cutover gate now rejects a reintroduced local FX
translation body (`loadV23Rates`, synthetic accrual construction, or local
`fxGainLoss` calculation inside the runtime wrapper).

TMS 21 journal, reclassification, export, and contract-tool consumers retain
their existing presentation flows and read the private result envelope. FX
rate administration and display remain UI/data-management concerns.
