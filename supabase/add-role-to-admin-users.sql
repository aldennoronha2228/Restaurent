-- =============================================================================
-- Add 'role' and 'full_name' columns to admin_users table
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

-- Add the role column if it doesn't exist
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner';

-- Add full_name column for display purposes
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Update existing records to have 'owner' role
UPDATE public.admin_users 
SET role = 'owner' 
WHERE role IS NULL;

-- Update full_name from email if not set
UPDATE public.admin_users 
SET full_name = split_part(email, '@', 1) 
WHERE full_name IS NULL;

-- Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);

-- Verify the change
SELECT email, role, full_name, is_active FROM public.admin_users ORDER BY created_at DESC;
