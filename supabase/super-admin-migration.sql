-- =============================================================================
-- SUPER ADMIN MIGRATION
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================
-- Adds super_admin role support and subscription management tables.
-- =============================================================================

-- ─── STEP 1: Update user_profiles role constraint ────────────────────────────
-- Add 'super_admin' as a valid role

ALTER TABLE public.user_profiles 
    DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles 
    ADD CONSTRAINT user_profiles_role_check 
    CHECK (role IN ('owner', 'admin', 'staff', 'super_admin'));


-- ─── STEP 2: Add subscription columns to restaurants ─────────────────────────

ALTER TABLE public.restaurants
    ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT '1k' CHECK (subscription_tier IN ('1k', '2k', '2.5k')),
    ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'cancelled', 'trial')),
    ADD COLUMN IF NOT EXISTS owner_email TEXT,
    ADD COLUMN IF NOT EXISTS monthly_revenue NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;


-- ─── STEP 3: Create global_logs table for activity tracking ─────────────────

CREATE TABLE IF NOT EXISTS public.global_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  TEXT NOT NULL,
    severity    TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'success')),
    message     TEXT NOT NULL,
    metadata    JSONB DEFAULT '{}',
    tenant_id   TEXT REFERENCES public.restaurants(id) ON DELETE SET NULL,
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast time-based queries
CREATE INDEX IF NOT EXISTS idx_global_logs_created_at ON public.global_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_global_logs_event_type ON public.global_logs(event_type);


-- ─── STEP 4: RLS for global_logs ─────────────────────────────────────────────

ALTER TABLE public.global_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "global_logs_super_admin_all" ON public.global_logs;
DROP POLICY IF EXISTS "global_logs_service_insert" ON public.global_logs;

-- Super admins can read all logs
CREATE POLICY "global_logs_super_admin_all"
    ON public.global_logs FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Service role can insert logs (from server actions)
-- Note: INSERT with service_role bypasses RLS anyway, but good to document


-- ─── STEP 5: Update restaurants RLS for super_admin ──────────────────────────

-- Super admins can see and manage ALL restaurants
DROP POLICY IF EXISTS "restaurants_super_admin_all" ON public.restaurants;

CREATE POLICY "restaurants_super_admin_all"
    ON public.restaurants FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );


-- ─── STEP 6: Function to check if user is super_admin ────────────────────────

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    );
$$;


-- ─── STEP 7: Function to get platform stats (for super admin dashboard) ──────

CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_restaurants INT;
    total_revenue NUMERIC;
    active_orders INT;
    new_signups_30d INT;
    result JSON;
BEGIN
    -- Only super_admins can call this
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT COUNT(*) INTO total_restaurants FROM public.restaurants;
    
    SELECT COALESCE(SUM(
        CASE subscription_tier 
            WHEN '1k' THEN 1000 
            WHEN '2k' THEN 2000 
            WHEN '2.5k' THEN 2500 
            ELSE 0 
        END
    ), 0) INTO total_revenue 
    FROM public.restaurants 
    WHERE subscription_status = 'active';
    
    SELECT COUNT(*) INTO active_orders 
    FROM public.orders 
    WHERE status IN ('new', 'preparing');
    
    SELECT COUNT(*) INTO new_signups_30d 
    FROM public.restaurants 
    WHERE created_at > NOW() - INTERVAL '30 days';

    result := json_build_object(
        'total_restaurants', total_restaurants,
        'total_revenue', total_revenue,
        'active_orders', active_orders,
        'new_signups_30d', new_signups_30d
    );
    
    RETURN result;
END;
$$;


-- ─── STEP 8: Update user_profiles RLS for super_admin ────────────────────────

-- Super admins can see ALL user profiles
DROP POLICY IF EXISTS "user_profiles_super_admin_select" ON public.user_profiles;

CREATE POLICY "user_profiles_super_admin_select"
    ON public.user_profiles FOR SELECT TO authenticated
    USING (
        id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );


-- ─── STEP 9: Log function for inserting activity logs ────────────────────────

CREATE OR REPLACE FUNCTION public.log_activity(
    p_event_type TEXT,
    p_message TEXT,
    p_severity TEXT DEFAULT 'info',
    p_metadata JSONB DEFAULT '{}',
    p_tenant_id TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO public.global_logs (event_type, severity, message, metadata, tenant_id, user_id)
    VALUES (p_event_type, p_severity, p_message, p_metadata, p_tenant_id, p_user_id)
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;


-- ─── STEP 10: Grant execute to authenticated users ───────────────────────────

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(TEXT, TEXT, TEXT, JSONB, TEXT, UUID) TO authenticated, service_role;


-- ─── STEP 11: Backfill owner_email from user_profiles ────────────────────────

UPDATE public.restaurants r
SET owner_email = (
    SELECT u.email 
    FROM auth.users u
    JOIN public.user_profiles p ON p.id = u.id
    WHERE p.tenant_id = r.id AND p.role = 'owner'
    LIMIT 1
)
WHERE owner_email IS NULL;


-- ============================================================================
-- To create a super admin user, run this after the user signs up:
-- UPDATE public.user_profiles SET role = 'super_admin' WHERE id = '<user_uuid>';
-- ============================================================================
