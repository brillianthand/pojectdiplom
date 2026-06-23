CREATE TABLE IF NOT EXISTS projects (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    color           TEXT NOT NULL DEFAULT '#3b82f6',
    icon            TEXT NOT NULL DEFAULT '📋',
    active_board_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS boards (
    id         TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    position   INT  NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS columns (
    id         TEXT PRIMARY KEY,
    board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '#f8fafc',
    text_color TEXT NOT NULL DEFAULT '#475569',
    position   INT  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY,
    column_id   TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priority    TEXT NOT NULL DEFAULT 'medium',
    type        TEXT NOT NULL DEFAULT 'task',
    completed   BOOLEAN NOT NULL DEFAULT FALSE,
    cover_image TEXT,
    start_date  DATE,
    due_date    DATE,
    position    INT  NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_tags (
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag     TEXT NOT NULL,
    PRIMARY KEY (task_id, tag)
);

CREATE TABLE IF NOT EXISTS task_assignees (
    task_id   TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    PRIMARY KEY (task_id, member_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id         TEXT PRIMARY KEY,
    task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author     TEXT NOT NULL,
    text       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
