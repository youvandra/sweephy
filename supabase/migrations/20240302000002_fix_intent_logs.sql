-- Ensure intents table exists
CREATE TABLE IF NOT EXISTS public.intents (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    device_id uuid NOT NULL,
    action text NOT NULL,
    pair text,
    amount numeric,
    status text DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT intents_pkey PRIMARY KEY (id)
);

-- Ensure intent_logs table exists
CREATE TABLE IF NOT EXISTS public.intent_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    intent_id uuid REFERENCES public.intents(id),
    tx_hash text,
    signed_by text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT intent_logs_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access for everyone (for dashboard visibility)
CREATE POLICY "Enable read access for all users" ON public.intents FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.intent_logs FOR SELECT USING (true);
