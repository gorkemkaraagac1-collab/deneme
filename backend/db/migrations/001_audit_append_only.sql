-- Audit kay1tlar1n1 append-only yapmak için migration.
-- Uygulama rolü INSERT/SELECT yapabilir; UPDATE/DELETE reddedilir.

CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events kay1tlar1 dei_tirilemez veya silinemez';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_append_only ON audit_events;
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_event_mutation();
