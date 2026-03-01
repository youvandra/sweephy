-- Add swap_amount column to rules table (default 50 HBAR)
ALTER TABLE public.rules 
ADD COLUMN IF NOT EXISTS swap_amount NUMERIC DEFAULT 50;
