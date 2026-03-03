-- Migration: Add tx_id to intents table
ALTER TABLE public.intents
ADD COLUMN IF NOT EXISTS tx_id TEXT;

-- Update status check constraint to include 'processing' and 'success'
ALTER TABLE public.intents
DROP CONSTRAINT IF EXISTS intents_status_check;

ALTER TABLE public.intents
ADD CONSTRAINT intents_status_check 
CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'failed', 'completed', 'success', 'warning'));
