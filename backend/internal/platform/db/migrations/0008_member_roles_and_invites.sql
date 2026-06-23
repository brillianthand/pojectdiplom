-- Wipe all existing data: starting fresh with new invite flow.
TRUNCATE users RESTART IDENTITY CASCADE;

-- Old email-based pending invites are replaced by project_members.status='pending'.
DROP TABLE IF EXISTS project_invitations;

-- project_members gains an explicit acceptance status.
ALTER TABLE project_members
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'accepted'
        CHECK (status IN ('pending', 'accepted'));

-- Notifications can reference a project (used for type='invite' to render accept/decline).
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS invited_by  TEXT REFERENCES users(id)    ON DELETE SET NULL;
