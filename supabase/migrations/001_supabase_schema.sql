-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS Table (Custom Profiles for WalletConnect)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT,
    wallet_address TEXT UNIQUE NOT NULL,
    two_fa_enabled BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DEVICES Table
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL means unclaimed
    name TEXT NOT NULL DEFAULT 'My ESP32 Device',
    secret_hash TEXT NOT NULL,
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'disabled')),
    is_paired BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAIRING CODES Table
CREATE TABLE IF NOT EXISTS public.pairing_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
    used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INTENTS Table
CREATE TABLE IF NOT EXISTS public.intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    pair TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'failed', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INTENT LOGS Table (Immutable audit trail)
CREATE TABLE IF NOT EXISTS public.intent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intent_id UUID REFERENCES public.intents(id) ON DELETE SET NULL,
    tx_hash TEXT,
    signed_by TEXT NOT NULL, -- 'kms' or 'walletconnect'
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- RULES Table
CREATE TABLE IF NOT EXISTS public.rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    max_per_swap NUMERIC DEFAULT 100,
    daily_limit NUMERIC DEFAULT 1000,
    cooldown_seconds INTEGER DEFAULT 60,
    slippage_tolerance NUMERIC DEFAULT 0.5,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WALLET KEYS Table (AWS KMS Reference)
CREATE TABLE IF NOT EXISTS public.wallet_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    kms_arn TEXT NOT NULL, -- Encrypted or stored as ARN
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_keys ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for PoC as users are not authenticated via Supabase Auth)
CREATE POLICY "Public read for profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public write for profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update for profiles" ON public.profiles FOR UPDATE USING (true);

CREATE POLICY "Public all for devices" ON public.devices FOR ALL USING (true);
CREATE POLICY "Public all for pairing_codes" ON public.pairing_codes FOR ALL USING (true);
CREATE POLICY "Public all for intents" ON public.intents FOR ALL USING (true);
CREATE POLICY "Public all for intent_logs" ON public.intent_logs FOR ALL USING (true);
CREATE POLICY "Public all for rules" ON public.rules FOR ALL USING (true);
CREATE POLICY "Public all for wallet_keys" ON public.wallet_keys FOR ALL USING (true);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON public.rules FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
