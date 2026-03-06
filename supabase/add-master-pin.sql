-- ============================================================
-- Add Master PIN to Restaurants Table
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Add master_pin column to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS master_pin TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.restaurants.master_pin IS 'Per-tenant master PIN for admin operations (set by restaurant owner during signup)';
