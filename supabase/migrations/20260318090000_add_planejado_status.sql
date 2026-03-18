-- Add 'planejado' to backlog_tasks status constraint
ALTER TABLE backlog_tasks DROP CONSTRAINT IF EXISTS backlog_tasks_status_check;
ALTER TABLE backlog_tasks ADD CONSTRAINT backlog_tasks_status_check
  CHECK (status IN ('backlog', 'planejado', 'fazendo', 'review', 'done'));
