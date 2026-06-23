ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS task_id  TEXT REFERENCES tasks(id)  ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS board_id TEXT REFERENCES boards(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_task_id  ON notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_board_id ON notifications(board_id);
