-- Sözleşme silinirken audit_events satırını UPDATE etmeye zorlayan FK'yi
-- kaldırır. Audit kayıtları append-only kalır ve contract_id geçmişteki
-- sözleşme kimliğini korur.
ALTER TABLE audit_events
  DROP CONSTRAINT IF EXISTS audit_events_contract_id_fkey;

