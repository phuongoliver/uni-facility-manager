-- Migration: Add price_type column and rename price_per_hour to price
-- Run this SQL manually on your PostgreSQL database

-- Add the PriceType enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pricetype') THEN
        CREATE TYPE pricetype AS ENUM ('PER_HOUR', 'PER_BOOKING', 'ONE_TIME');
    END IF;
END$$;

-- Add the price_type column with default value PER_HOUR
ALTER TABLE facilities 
ADD COLUMN IF NOT EXISTS price_type pricetype DEFAULT 'PER_HOUR';

-- Rename price_per_hour to price if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facilities' AND column_name = 'price_per_hour') THEN
        ALTER TABLE facilities RENAME COLUMN price_per_hour TO price;
    END IF;
END$$;

-- Update price_type for all existing records to PER_HOUR
UPDATE facilities SET price_type = 'PER_HOUR' WHERE price_type IS NULL;

-- Make the column NOT NULL after setting defaults
ALTER TABLE facilities ALTER COLUMN price_type SET NOT NULL;
