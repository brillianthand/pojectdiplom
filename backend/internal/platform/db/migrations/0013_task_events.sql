CREATE TABLE IF NOT EXISTS task_events (
    id         TEXT PRIMARY KEY,
    task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
    type       TEXT NOT NULL,
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id, created_at);
