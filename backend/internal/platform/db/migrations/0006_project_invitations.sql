CREATE TABLE IF NOT EXISTS project_invitations (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    invited_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
    role        TEXT NOT NULL DEFAULT 'member',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_unique
    ON project_invitations (project_id, LOWER(email))
    WHERE accepted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invitations_email_pending
    ON project_invitations (LOWER(email))
    WHERE accepted_at IS NULL;
