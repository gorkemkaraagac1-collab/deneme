# Database migrations

Production database changes are applied from this directory in numeric order. Each migration must be numbered with a stable prefix, be idempotent where possible, run with psql -v ON_ERROR_STOP=1, and be recorded with operator, UTC timestamp, commit SHA, database, and result.

## Current baseline

| Version | File | Purpose | Production status |
| --- | --- | --- | --- |
| 001 | 001_audit_append_only.sql | Prevent UPDATE/DELETE on audit_events | Applied and verified |
| 002 | 002_audit_contract_delete.sql | Preserve append-only audit rows when a contract is deleted | Pending deployment |
| 003 | 003_faq_items.sql | Create faq_items table + seed marketing-site FAQ content | Pending deployment |

The table above documents the verified production state. It is not permission to re-run an unreviewed migration against another database.

## Apply procedure

1. Confirm project, Cloud SQL instance, database, and release commit.
2. Confirm a recent backup before schema changes.
3. Run the reviewed migration with psql -v ON_ERROR_STOP=1 -f backend/db/migrations/<file>.
4. Query the affected object or constraint and save the output with deployment evidence.
5. Record success or failure in the release runbook.

## Rollback

Migration 002 rollback is intentionally not automatic: restoring the foreign key with `ON DELETE SET NULL` would conflict with the append-only trigger. If referential enforcement is required, use a reviewed archival design that does not mutate audit rows.


Every migration must document a reviewed rollback or compensating procedure before production application. Destructive rollback SQL is never run automatically. Removing the audit append-only trigger requires explicit security review because it weakens an ITGC control.
