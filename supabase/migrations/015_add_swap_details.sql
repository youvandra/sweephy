-- Add new fields to intents table for swap details
ALTER TABLE public.intents
ADD COLUMN IF NOT EXISTS amount_received NUMERIC,
ADD COLUMN IF NOT EXISTS tx_id_swap TEXT,
ADD COLUMN IF NOT EXISTS tx_id_transfer TEXT,
ADD COLUMN IF NOT EXISTS tx_id_refund TEXT;

-- Update the status check if needed (already covers 'completed', 'failed', etc)
-- No changes needed for status check as 'completed' exists.
