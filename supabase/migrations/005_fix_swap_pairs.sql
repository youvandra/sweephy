-- Ensure table exists
CREATE TABLE IF NOT EXISTS public.swap_pairs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    pair_name text NOT NULL,
    token_a text,
    token_b text,
    saucerswap_pool_id text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT swap_pairs_pkey PRIMARY KEY (id),
    CONSTRAINT swap_pairs_pair_name_key UNIQUE (pair_name)
);

-- Add columns if they were missing (idempotent)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='swap_pairs' AND column_name='token_a') THEN
        ALTER TABLE public.swap_pairs ADD COLUMN token_a text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='swap_pairs' AND column_name='token_b') THEN
        ALTER TABLE public.swap_pairs ADD COLUMN token_b text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='swap_pairs' AND column_name='saucerswap_pool_id') THEN
        ALTER TABLE public.swap_pairs ADD COLUMN saucerswap_pool_id text;
    END IF;
END $$;

-- Enable RLS (Security Best Practice)
ALTER TABLE public.swap_pairs ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (Authenticated + Anon)
CREATE POLICY "Enable read access for all users" ON public.swap_pairs
    FOR SELECT
    USING (true);

-- Allow write access only to service_role (Admin functions)
-- If you want admins to edit via dashboard, add a policy for authenticated users with is_admin=true

-- Seed Data: HBAR/USDC
-- Note: Replace '0.0.1062664' with the REAL SaucerSwap Pool ID if known, otherwise this is a placeholder
INSERT INTO public.swap_pairs (pair_name, token_a, token_b, is_active, saucerswap_pool_id)
VALUES ('HBAR/USDC', '0.0.0', '0.0.456858', true, '0.0.1062664')
ON CONFLICT (pair_name) DO UPDATE 
SET 
  token_a = EXCLUDED.token_a,
  token_b = EXCLUDED.token_b,
  is_active = EXCLUDED.is_active,
  saucerswap_pool_id = EXCLUDED.saucerswap_pool_id;
