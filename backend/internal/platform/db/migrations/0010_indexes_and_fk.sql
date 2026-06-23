-- FK: при удалении пользователя убираем его из исполнителей задач
ALTER TABLE task_assignees
  ADD CONSTRAINT fk_task_assignees_user
  FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE;

-- Индексы на FK-колонки (PostgreSQL не создаёт их автоматически)
CREATE INDEX IF NOT EXISTS idx_tasks_column_id      ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_task_id    ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task  ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_task_id     ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id     ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
