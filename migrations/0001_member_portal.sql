PRAGMA foreign_keys = ON;
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  mobile TEXT NOT NULL DEFAULT '',
  source_email TEXT NOT NULL DEFAULT '',
  profession TEXT NOT NULL DEFAULT '',
  designation TEXT NOT NULL DEFAULT '',
  organization TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  photo_id TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1))
);
CREATE TABLE identities (
  id TEXT PRIMARY KEY,
  member_id TEXT UNIQUE REFERENCES members(id),
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  google_sub TEXT UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('member','admin')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  CHECK(role = 'admin' OR member_id IS NOT NULL)
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES identities(id),
  csrf TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires);
CREATE TABLE challenges (token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE media (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  mime TEXT NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp')),
  bytes BLOB NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX media_member ON media(member_id);
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  base_revision INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  profession TEXT NOT NULL,
  designation TEXT NOT NULL,
  organization TEXT NOT NULL,
  bio TEXT NOT NULL,
  photo_id TEXT,
  publication_consent INTEGER NOT NULL CHECK(publication_consent = 1),
  status TEXT NOT NULL CHECK(status IN ('pending','approved','returned')),
  reason TEXT NOT NULL DEFAULT '',
  submitted_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewer_id TEXT REFERENCES identities(id)
);
CREATE UNIQUE INDEX one_pending_per_member ON submissions(member_id) WHERE status='pending';
CREATE INDEX submissions_member ON submissions(member_id,submitted_at);
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES identities(id),
  action TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
-- Approval is a single guarded UPDATE; triggers publish and record review atomically.
CREATE TRIGGER review_revision_guard BEFORE UPDATE OF status ON submissions
WHEN OLD.status='pending' AND NEW.status='approved'
BEGIN
  SELECT CASE WHEN (SELECT revision FROM members WHERE id=NEW.member_id) != NEW.base_revision
    THEN RAISE(ABORT,'STALE_REVISION') END;
END;
CREATE TRIGGER publish_approved AFTER UPDATE OF status ON submissions
WHEN OLD.status='pending' AND NEW.status='approved'
BEGIN
  UPDATE members SET full_name=NEW.full_name,mobile=NEW.mobile,profession=NEW.profession,
    designation=NEW.designation,organization=NEW.organization,bio=NEW.bio,
    photo_id=NEW.photo_id,revision=revision+1,published=1 WHERE id=NEW.member_id;
END;
CREATE TRIGGER audit_review AFTER UPDATE OF status ON submissions
WHEN OLD.status='pending' AND NEW.status IN ('approved','returned')
BEGIN
  INSERT INTO audit_log VALUES(NEW.id || ':' || NEW.status,NEW.reviewer_id,NEW.status,NEW.id,NEW.reviewed_at);
END;
