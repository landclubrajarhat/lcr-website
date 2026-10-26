-- Apply once to the test database before enabling MEMBER_PASSWORD_ENABLED.
CREATE TABLE member_passwords (
  identity_id TEXT PRIMARY KEY REFERENCES identities(id),
  password_hash TEXT NOT NULL,
  must_change INTEGER NOT NULL DEFAULT 1 CHECK(must_change IN (0,1)),
  temporary_expires INTEGER,
  updated_at INTEGER NOT NULL
);
-- Password creation/reset/change revokes every previous session atomically.
CREATE TRIGGER password_insert_revoke AFTER INSERT ON member_passwords
BEGIN
  DELETE FROM sessions WHERE identity_id=NEW.identity_id;
END;
CREATE TRIGGER password_update_revoke AFTER UPDATE ON member_passwords
BEGIN
  DELETE FROM sessions WHERE identity_id=NEW.identity_id;
END;
