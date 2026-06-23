-- New role model on project_members:
--   admin    — full project access except deleting the project and transferring ownership
--   manager  — manages boards, columns, tasks and members (cannot grant/revoke admin)
--   executor — works with tasks and comments; can be a task assignee
--   observer — read-only (no comments, cannot be an assignee)
--
-- Ownership stays on projects.owner_id (the single user who can delete the project
-- or transfer it). The owner is always reflected as 'admin' in project_members.

-- 1. Map legacy values to the new vocabulary.
UPDATE project_members SET role = 'admin'    WHERE role = 'owner';
UPDATE project_members SET role = 'executor' WHERE role = 'member';
UPDATE project_members SET role = 'observer' WHERE role = 'viewer';

-- 2. Anything unexpected falls back to executor so the CHECK below cannot fail.
UPDATE project_members
SET role = 'executor'
WHERE role NOT IN ('admin', 'manager', 'executor', 'observer');

-- 3. Make sure every owner is at least admin in project_members.
UPDATE project_members pm
SET role = 'admin'
FROM projects p
WHERE pm.project_id = p.id
  AND pm.user_id    = p.owner_id
  AND pm.role <> 'admin';

-- 4. Enforce the new vocabulary at the DB level.
ALTER TABLE project_members
    DROP CONSTRAINT IF EXISTS project_members_role_check;

ALTER TABLE project_members
    ADD CONSTRAINT project_members_role_check
        CHECK (role IN ('admin', 'manager', 'executor', 'observer'));

-- 5. New default for freshly inserted rows.
ALTER TABLE project_members
    ALTER COLUMN role SET DEFAULT 'executor';
