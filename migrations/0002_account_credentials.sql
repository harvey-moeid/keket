ALTER TABLE sessions ADD COLUMN credential_version TEXT NOT NULL DEFAULT 'bootstrap';
DELETE FROM sessions;
