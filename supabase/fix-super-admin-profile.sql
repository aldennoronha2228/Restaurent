-- Fix: Allow NULL tenant_id for super_admin users
-- Run this in Supabase Dashboard → SQL Editor

-- Step 1: Drop the NOT NULL constraint on tenant_id (if it exists as a constraint)
-- First check if it's a column constraint vs table constraint
ALTER TABLE public.user_profiles 
    ALTER COLUMN tenant_id DROP NOT NULL;

-- Step 2: Insert super admin profile
INSERT INTO public.user_profiles (id, role, full_name, tenant_id)
VALUES ('d6600991-a597-4d4f-ad88-e97a5ef74676', 'super_admin', 'Alden Noronha', NULL)
ON CONFLICT (id) DO UPDATE SET role = 'super_admin', tenant_id = NULL;

-- Verify
SELECT * FROM public.user_profiles WHERE role = 'super_admin';
