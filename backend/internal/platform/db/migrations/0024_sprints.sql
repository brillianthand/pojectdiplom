-- 0024_sprints.sql
-- Спринты для Scrum-режима

CREATE TABLE IF NOT EXISTS sprints (
    id         TEXT        PRIMARY KEY,
    board_id   TEXT        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name       TEXT        NOT NULL DEFAULT '',
    goal       TEXT        NOT NULL DEFAULT '',
    status     TEXT        NOT NULL DEFAULT 'planning'
                           CHECK (status IN ('planning', 'active', 'completed')),
    start_date DATE,
    end_date   DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sprints_board_id  ON sprints(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id   ON tasks(sprint_id) WHERE sprint_id IS NOT NULL;
