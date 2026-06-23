-- Personal "favorites" — each (user, task) pair is a star.
-- CASCADE on both FKs so deleting a user or task wipes their stars.
CREATE TABLE IF NOT EXISTS task_stars (
    user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id    TEXT        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_stars_user ON task_stars(user_id, created_at DESC);
