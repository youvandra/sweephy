-- Add 'note' column to 'intents' table for storing failure reasons or additional info
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'intents' AND column_name = 'note') THEN
        ALTER TABLE public.intents ADD COLUMN note TEXT;
    END IF;
END $$;
