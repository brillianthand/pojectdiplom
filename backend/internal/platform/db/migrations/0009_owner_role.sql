-- Rename 'manager' role to 'owner' for project creators, downgrade others to 'member'.
UPDATE project_members pm
SET role = 'owner'
FROM projects p
WHERE pm.project_id = p.id
  AND pm.user_id = p.owner_id
  AND pm.role = 'manager';

UPDATE project_members
SET role = 'member'
WHERE role = 'manager';
