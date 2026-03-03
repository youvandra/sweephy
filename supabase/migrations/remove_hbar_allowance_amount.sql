-- Remove hbar_allowance_amount from rules table as we now fetch it directly from Mirror Node
ALTER TABLE rules DROP COLUMN IF EXISTS hbar_allowance_amount;
