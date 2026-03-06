-- =============================================================================
-- Super Admin Logs Table
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

-- Create the super_admin_logs table
CREATE TABLE IF NOT EXISTS public.super_admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'success')),
    admin_email TEXT,
    target_restaurant_id TEXT REFERENCES public.restaurants(id) ON DELETE SET NULL,
    target_user_id UUID,
    target_email TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.super_admin_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins and service role can access
CREATE POLICY "super_admin_logs_super_admin_all"
    ON public.super_admin_logs FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_super_admin_logs_created_at 
    ON public.super_admin_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_admin_logs_action_type 
    ON public.super_admin_logs(action_type);

CREATE INDEX IF NOT EXISTS idx_super_admin_logs_target_restaurant 
    ON public.super_admin_logs(target_restaurant_id);

-- Comment
COMMENT ON TABLE public.super_admin_logs IS 'Audit log for all super admin actions';
