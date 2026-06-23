-- Personal tasks: a private per-user checklist not tied to any project/board.
-- No priority/tags/assignees — just title, optional due date, optional note.
CREATE TABLE IF NOT EXISTS personal_tasks (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    notes        TEXT NOT NULL DEFAULT '',
    completed    BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    due_date     DATE,
    position     DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_tasks_user
    ON personal_tasks (user_id, position, created_at);
