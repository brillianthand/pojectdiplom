CREATE TABLE IF NOT EXISTS subtasks (
    id        TEXT PRIMARY KEY,
    task_id   TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title     TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    position  INT     NOT NULL DEFAULT 0
);
