-- Per-board automation/display settings as JSONB.
-- Shape (all fields optional, defaults applied server-side):
-- {
--   "autoMoveOnComplete": bool,
--   "autoMoveColumnId":   "",     -- empty = last column
--   "autoArchiveEnabled": bool,
--   "autoArchiveDays":    7
-- }
ALTER TABLE boards
    ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
