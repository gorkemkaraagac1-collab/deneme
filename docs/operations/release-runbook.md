# TFRS16 Production Operations Runbook

## Scope
This runbook covers the production TFRS16 backend on Cloud Run and its Cloud SQL database. Do not place passwords, tokens, or connection strings in tickets or logs.

## Health and first response
1. Check the Cloud Run service and revision status.
2. Check the public /health endpoint. A healthy response is HTTP 200 with database: ok.
3. Review Cloud Run logs for startup, database, authentication, and 5xx errors.
4. If the service is degraded, stop release activity and preserve the incident timestamp, revision, and relevant log links.

## Database protection
- Cloud SQL automated backups and PITR must remain enabled.
- Before a schema change, record the backup identifier and migration filename.
- Apply migrations with ON_ERROR_STOP=1 using the approved database account.
- Verify the expected schema object after the migration.
- For the audit append-only migration, verify that INSERT still works and UPDATE/DELETE are rejected.

## Rollback
- Prefer Cloud Run traffic rollback to the last known healthy revision.
- Do not roll back database changes by deleting data. Use a reviewed reverse migration or restore to a temporary instance first.
- After rollback, check /health, login, company access, and one representative TFRS16 calculation.

## Incident evidence
Record: UTC start/end time, reporter, affected revision, symptoms, alert/check, actions, result, and follow-up owner. Keep evidence read-only and redact credentials.

## Release gate
A production release requires green CI checks, reviewed PR, verified secrets, successful health check, and a documented rollback target. Notification channels are added when the production domain and operations mailbox are available.
