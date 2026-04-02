-- Add screenshot column to automation_runs for storing final browser state
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS screenshot_base64 TEXT;
