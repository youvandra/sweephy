-- Add tx_id_receipt column to intents table
ALTER TABLE public.intents
ADD COLUMN IF NOT EXISTS tx_id_receipt TEXT;
