ALTER TABLE boards ADD COLUMN IF NOT EXISTS share_token TEXT DEFAULT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_boards_share_token ON boards(share_token) WHERE share_token IS NOT NULL;
