ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS trigger_price NUMERIC;
