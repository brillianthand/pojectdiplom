CREATE TABLE IF NOT EXISTS comment_attachments (
    id           TEXT PRIMARY KEY,
    comment_id   TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    filename     TEXT NOT NULL DEFAULT '',
    content_type TEXT NOT NULL DEFAULT '',
    data         BYTEA NOT NULL,
    size_bytes   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_attachments_comment
    ON comment_attachments (comment_id, created_at);
