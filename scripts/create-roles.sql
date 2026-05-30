-- Replace placeholder passwords before production use.
-- Run as a superuser after database exists.

CREATE ROLE app_user WITH LOGIN PASSWORD 'APP_USER_PASSWORD';
GRANT CONNECT ON DATABASE propertysales_db TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

CREATE ROLE migrator WITH BYPASSRLS LOGIN PASSWORD 'MIGRATOR_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE propertysales_db TO migrator;
