# TFRS 16 Phase 7 — public engine cleanup

The public runtime now keeps only UI input handling, authenticated API
bridges, private-result cache access, formatting, and presentation helpers.
The obsolete browser-side discount-rate convention helpers, payment-date
builder, and inception current/non-current split helpers were removed after a
repository-wide reference check showed no production consumer.

Reporting-date liability classification continues to read the private
reporting-date envelope. TMS 21, TMS 29, modification, reassessment, early
payment, and special-flow accounting results continue to come from the private
facade. The private engine source is unchanged.
