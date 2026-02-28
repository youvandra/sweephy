-- Update Rules Table to support Allowance status
ALTER TABLE public.rules 
ADD COLUMN IF NOT EXISTS allowance_granted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hbar_allowance_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_allowance_update TIMESTAMPTZ;

-- Update Wallet Keys to store Public Key for allowance verification
ALTER TABLE public.wallet_keys
ADD COLUMN IF NOT EXISTS kms_public_key TEXT;

-- Create table for specific swap configurations
CREATE TABLE IF NOT EXISTS public.swap_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pair_name TEXT UNIQUE NOT NULL, -- e.g. 'HBAR/USDC'
    saucerswap_pool_id TEXT,
    token_a_id TEXT,
    token_b_id TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Seed SaucerSwap HBAR/USDC pool (Example for Hedera Mainnet)
INSERT INTO public.swap_pairs (pair_name, saucerswap_pool_id, token_a_id, token_b_id)
VALUES ('HBAR/USDC', '0.0.3949420', 'HBAR', '0.0.456858')
ON CONFLICT (pair_name) DO NOTHING;
