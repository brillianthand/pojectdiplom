ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_admin   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;

-- Promote the earliest-registered user to admin if no admin exists yet.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE is_admin = TRUE) THEN
        UPDATE users
           SET is_admin = TRUE
         WHERE id = (SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1);
    END IF;
END $$;
