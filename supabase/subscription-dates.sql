-- ============================================================
-- Subscription Dates Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Add subscription start and end date columns to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS subscription_start_date DATE,
ADD COLUMN IF NOT EXISTS subscription_end_date DATE;

-- Create index for faster queries on dates
CREATE INDEX IF NOT EXISTS idx_restaurants_subscription_dates 
    ON public.restaurants(subscription_end_date, subscription_start_date);

-- Optional: Set start date to created_at for existing restaurants
UPDATE public.restaurants 
SET subscription_start_date = DATE(created_at)
WHERE subscription_start_date IS NULL;

-- Comment for reference
COMMENT ON COLUMN public.restaurants.subscription_start_date IS 'Date when the subscription starts/started';
COMMENT ON COLUMN public.restaurants.subscription_end_date IS 'Date when the subscription ends (null = no end date)';
