-- Add completed_at to tasks so we can compute velocity / completed-per-day metrics.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill: for tasks that are already completed, use the latest "completed_changed → true"
-- event timestamp if we have it; otherwise fall back to created_at as a best-effort guess.
UPDATE tasks t
SET completed_at = COALESCE(
  (
    SELECT e.created_at
    FROM task_events e
    WHERE e.task_id = t.id
      AND e.type = 'completed_changed'
      AND e.payload->>'completed' = 'true'
    ORDER BY e.created_at DESC
    LIMIT 1
  ),
  t.created_at
)
WHERE t.completed = TRUE AND t.completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL;
