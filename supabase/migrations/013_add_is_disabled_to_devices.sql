-- Migration to add 'is_disabled' column to 'devices' table
-- This allows explicit enabling/disabling of devices separate from their online/offline status.

DO $$ 
BEGIN
    -- Check if 'is_disabled' column exists, if not, add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'is_disabled') THEN
        ALTER TABLE public.devices ADD COLUMN is_disabled BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
