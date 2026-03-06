-- =============================================================================
-- TWO-TIER SUBSCRIPTION MODEL MIGRATION
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================
-- Simplifies the subscription model from 3 tiers (1k, 2k, 2.5k) to 2 tiers:
--   - Starter: ₹1,000/month (basic features)
--   - Pro: ₹2,000/month (all features including Table-Side Ordering, Custom Branding)
-- =============================================================================

-- ─── STEP 1: DROP the old constraint FIRST ───────────────────────────────────
-- Must drop before updating values!

ALTER TABLE public.restaurants 
    DROP CONSTRAINT IF EXISTS restaurants_subscription_tier_check;


-- ─── STEP 2: Migrate existing tier values ────────────────────────────────────
-- Any restaurant on the old Elite tier gets moved to Pro

UPDATE public.restaurants 
SET subscription_tier = 'pro' 
WHERE subscription_tier = '2.5k';

-- Also migrate 2k → pro for consistency
UPDATE public.restaurants 
SET subscription_tier = 'pro' 
WHERE subscription_tier = '2k';

-- Migrate 1k → starter
UPDATE public.restaurants 
SET subscription_tier = 'starter' 
WHERE subscription_tier = '1k';


-- ─── STEP 3: Add the NEW constraint with starter/pro only ────────────────────

ALTER TABLE public.restaurants 
    ADD CONSTRAINT restaurants_subscription_tier_check 
    CHECK (subscription_tier IN ('starter', 'pro'));

-- Update default to 'starter'
ALTER TABLE public.restaurants 
    ALTER COLUMN subscription_tier SET DEFAULT 'starter';


-- ─── STEP 4: Update the get_platform_stats function for new tiers ────────────

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
    
    -- Updated tier pricing: starter = 1000, pro = 2000
    SELECT COALESCE(SUM(
        CASE subscription_tier 
            WHEN 'starter' THEN 1000 
            WHEN 'pro' THEN 2000 
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


-- ─── STEP 4: Add helper function to check if restaurant has Pro tier ─────────

CREATE OR REPLACE FUNCTION public.is_pro_tier(p_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.restaurants 
        WHERE id = p_tenant_id AND subscription_tier = 'pro'
    );
$$;


-- ─── STEP 5: RLS Policies for Pro-only features ──────────────────────────────
-- These ensure only Pro tier restaurants can access certain tables

-- Create analytics table if it doesn't exist (Pro-only feature)
CREATE TABLE IF NOT EXISTS public.analytics_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL,
    metric_value NUMERIC,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Create branding_settings table if it doesn't exist (Pro-only feature)
CREATE TABLE IF NOT EXISTS public.branding_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id TEXT UNIQUE NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    primary_color TEXT DEFAULT '#3B82F6',
    secondary_color TEXT DEFAULT '#6366F1',
    logo_url TEXT,
    custom_font TEXT,
    custom_css TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create inventory table if it doesn't exist (Pro-only feature)
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INT DEFAULT 0,
    unit TEXT DEFAULT 'units',
    reorder_level INT DEFAULT 10,
    cost_per_unit NUMERIC(10,2),
    supplier TEXT,
    last_restocked TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE public.analytics_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only Pro tier restaurants can access analytics_data
DROP POLICY IF EXISTS "Pro tier access for analytics" ON public.analytics_data;
CREATE POLICY "Pro tier access for analytics" ON public.analytics_data
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants 
            WHERE id = tenant_id 
            AND subscription_tier = 'pro'
            AND subscription_status = 'active'
        )
        AND tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    );

-- RLS Policy: Only Pro tier restaurants can access branding_settings
DROP POLICY IF EXISTS "Pro tier access for branding" ON public.branding_settings;
CREATE POLICY "Pro tier access for branding" ON public.branding_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants 
            WHERE id = tenant_id 
            AND subscription_tier = 'pro'
            AND subscription_status = 'active'
        )
        AND tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    );

-- RLS Policy: Only Pro tier restaurants can access inventory
DROP POLICY IF EXISTS "Pro tier access for inventory" ON public.inventory;
CREATE POLICY "Pro tier access for inventory" ON public.inventory
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants 
            WHERE id = tenant_id 
            AND subscription_tier = 'pro'
            AND subscription_status = 'active'
        )
        AND tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
    );


-- ─── STEP 6: Function to check if restaurant subscription is active ─────────

CREATE OR REPLACE FUNCTION public.is_subscription_active(p_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.restaurants 
        WHERE id = p_tenant_id AND subscription_status = 'active'
    );
$$;


-- =============================================================================
-- VERIFICATION: Run these queries to verify migration worked
-- =============================================================================
-- SELECT subscription_tier, COUNT(*) FROM restaurants GROUP BY subscription_tier;
-- SELECT * FROM restaurants LIMIT 5;
-- \d analytics_data
-- \d branding_settings
-- \d inventory
