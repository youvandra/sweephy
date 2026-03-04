-- Add new columns to intents table
ALTER TABLE intents 
ADD COLUMN IF NOT EXISTS signed_by TEXT,
ADD COLUMN IF NOT EXISTS tx_hash TEXT,
ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;

-- Migrate data from intent_logs to intents
UPDATE intents
SET 
  signed_by = intent_logs.signed_by,
  tx_hash = intent_logs.tx_hash,
  executed_at = intent_logs.timestamp
FROM intent_logs
WHERE intents.id = intent_logs.intent_id;

-- Optional: If you want to keep intent_logs as backup, do nothing more.
-- If you want to drop it as requested "combine ... for just 1 table", we can drop it.
-- But usually safer to keep it for a while or rename it.
-- The user said "combine data ... in supabase for just 1 table".
-- So I will drop it to be clean, or at least we stop using it.
-- Let's drop it to fully comply with "just 1 table".
DROP TABLE IF EXISTS intent_logs;
