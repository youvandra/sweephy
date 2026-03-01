-- Update Profiles Table to store Hedera Account ID
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hedera_account_id TEXT;

-- Create an index for fast lookups by Hedera ID
CREATE INDEX IF NOT EXISTS idx_profiles_hedera_account_id ON public.profiles(hedera_account_id);

-- Optional: If you want to enforce uniqueness (one profile per Hedera ID)
-- ALTER TABLE public.profiles ADD CONSTRAINT unique_hedera_account_id UNIQUE (hedera_account_id);
