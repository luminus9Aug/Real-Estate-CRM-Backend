-- Run after migrations. tenant_id columns are text/varchar (cuid); compare to session text.
-- PgBouncer must use pool_mode = session (not transaction) when using set_config for RLS.

DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'leads','properties','users','messages','activities',
      'follow_ups','commission_transactions','brochure_links'
    )
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING     (tenant_id::text = current_setting(''app.current_tenant_id'', true))
         WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true))',
      tbl
    );
  END LOOP;
END $$;
