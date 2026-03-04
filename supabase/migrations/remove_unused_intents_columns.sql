-- Migration to remove unused columns from the 'intents' table
-- This migration removes 'signed_by', 'tx_hash', and 'executed_at' columns as they are no longer needed.
-- Transaction ID is now stored in 'tx_id' and timestamp in 'created_at'.

DO $$ 
BEGIN
    -- Check and drop 'signed_by' column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'intents' AND column_name = 'signed_by') THEN
        ALTER TABLE public.intents DROP COLUMN signed_by;
    END IF;

    -- Check and drop 'tx_hash' column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'intents' AND column_name = 'tx_hash') THEN
        ALTER TABLE public.intents DROP COLUMN tx_hash;
    END IF;

    -- Check and drop 'executed_at' column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'intents' AND column_name = 'executed_at') THEN
        ALTER TABLE public.intents DROP COLUMN executed_at;
    END IF;
END $$;
