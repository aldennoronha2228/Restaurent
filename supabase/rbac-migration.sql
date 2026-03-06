-- =============================================================================
-- ROLE-BASED ACCESS CONTROL (RBAC) - PRO TIER FEATURE
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================
-- PURPOSE: Implement role-based permissions for restaurant staff
-- ROLES: owner, manager, staff (admin legacy support)
-- STARTER: Only 'owner' role allowed (single admin)
-- PRO: Multiple roles with different permissions
-- =============================================================================


-- ─── STEP 1: Update user_profiles role constraint ────────────────────────────

ALTER TABLE public.user_profiles 
    DROP CONSTRAINT IF EXISTS user_profiles_role_check;
    
ALTER TABLE public.user_profiles 
    ADD CONSTRAINT user_profiles_role_check 
    CHECK (role IN ('owner', 'manager', 'staff', 'admin', 'super_admin'));


-- ─── STEP 2: Create role permissions reference table ─────────────────────────

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT,
    can_view_orders BOOLEAN DEFAULT true,
    can_manage_orders BOOLEAN DEFAULT true,
    can_view_menu BOOLEAN DEFAULT true,
    can_manage_menu BOOLEAN DEFAULT false,
    can_view_tables BOOLEAN DEFAULT true,
    can_manage_tables BOOLEAN DEFAULT false,
    can_view_history BOOLEAN DEFAULT true,
    can_view_analytics BOOLEAN DEFAULT false,
    can_view_inventory BOOLEAN DEFAULT false,
    can_manage_inventory BOOLEAN DEFAULT false,
    can_view_branding BOOLEAN DEFAULT false,
    can_manage_branding BOOLEAN DEFAULT false,
    can_view_account BOOLEAN DEFAULT false,
    can_manage_admins BOOLEAN DEFAULT false,
    can_view_billing BOOLEAN DEFAULT false,
    tier_required TEXT DEFAULT 'starter' CHECK (tier_required IN ('starter', 'pro'))
);

-- Insert default role permissions
INSERT INTO public.role_permissions (role, display_name, description, can_view_orders, can_manage_orders, can_view_menu, can_manage_menu, can_view_tables, can_manage_tables, can_view_history, can_view_analytics, can_view_inventory, can_manage_inventory, can_view_branding, can_manage_branding, can_view_account, can_manage_admins, can_view_billing, tier_required)
VALUES 
    ('owner', 'Owner', 'Full access to all features', true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, 'starter'),
    ('manager', 'Manager', 'Can manage daily operations but not billing', true, true, true, true, true, true, true, true, true, true, true, true, true, false, false, 'pro'),
    ('staff', 'Staff', 'Limited to orders and tables only', true, true, false, false, true, false, false, false, false, false, false, false, false, false, false, 'pro'),
    ('admin', 'Admin (Legacy)', 'Legacy admin role - same as owner', true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, 'starter')
ON CONFLICT (role) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    can_view_orders = EXCLUDED.can_view_orders,
    can_manage_orders = EXCLUDED.can_manage_orders,
    can_view_menu = EXCLUDED.can_view_menu,
    can_manage_menu = EXCLUDED.can_manage_menu,
    can_view_tables = EXCLUDED.can_view_tables,
    can_manage_tables = EXCLUDED.can_manage_tables,
    can_view_history = EXCLUDED.can_view_history,
    can_view_analytics = EXCLUDED.can_view_analytics,
    can_view_inventory = EXCLUDED.can_view_inventory,
    can_manage_inventory = EXCLUDED.can_manage_inventory,
    can_view_branding = EXCLUDED.can_view_branding,
    can_manage_branding = EXCLUDED.can_manage_branding,
    can_view_account = EXCLUDED.can_view_account,
    can_manage_admins = EXCLUDED.can_manage_admins,
    can_view_billing = EXCLUDED.can_view_billing,
    tier_required = EXCLUDED.tier_required;


-- ─── STEP 3: Function to check if role is allowed for tier ───────────────────

CREATE OR REPLACE FUNCTION public.is_role_allowed_for_tier(p_role TEXT, p_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier TEXT;
    v_tier_required TEXT;
BEGIN
    -- Get restaurant's subscription tier
    SELECT subscription_tier INTO v_tier
    FROM public.restaurants
    WHERE id = p_tenant_id;

    -- Get the tier required for this role
    SELECT tier_required INTO v_tier_required
    FROM public.role_permissions
    WHERE role = p_role;

    -- If role not found, deny
    IF v_tier_required IS NULL THEN
        RETURN false;
    END IF;

    -- Starter tier can only use 'starter' roles (owner, admin)
    IF v_tier IN ('starter', '1k') THEN
        RETURN v_tier_required = 'starter';
    END IF;

    -- Pro tier can use all roles
    RETURN true;
END;
$$;


-- ─── STEP 4: Function to enforce starter tier admin limit ────────────────────

CREATE OR REPLACE FUNCTION public.check_admin_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier TEXT;
    v_admin_count INT;
BEGIN
    -- Get restaurant's subscription tier
    SELECT subscription_tier INTO v_tier
    FROM public.restaurants
    WHERE id = NEW.tenant_id;

    -- If starter tier, check admin count
    IF v_tier IN ('starter', '1k') THEN
        SELECT COUNT(*) INTO v_admin_count
        FROM public.user_profiles
        WHERE tenant_id = NEW.tenant_id
          AND role IN ('owner', 'admin', 'manager', 'staff')
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

        -- Starter tier allows only 1 admin (owner)
        IF v_admin_count >= 1 THEN
            RAISE EXCEPTION 'Starter tier allows only one admin. Upgrade to Pro to add more team members.';
        END IF;

        -- Starter tier can only have 'owner' role
        IF NEW.role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Starter tier only supports owner role. Upgrade to Pro for manager and staff roles.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger for admin limit check
DROP TRIGGER IF EXISTS enforce_admin_limit ON public.user_profiles;
CREATE TRIGGER enforce_admin_limit
    BEFORE INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_admin_limit();


-- ─── STEP 5: Function to get user permissions ────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_permissions JSONB;
BEGIN
    -- Get user's role
    SELECT role INTO v_role
    FROM public.user_profiles
    WHERE id = p_user_id;

    -- Get permissions for role
    SELECT jsonb_build_object(
        'role', rp.role,
        'display_name', rp.display_name,
        'can_view_orders', rp.can_view_orders,
        'can_manage_orders', rp.can_manage_orders,
        'can_view_menu', rp.can_view_menu,
        'can_manage_menu', rp.can_manage_menu,
        'can_view_tables', rp.can_view_tables,
        'can_manage_tables', rp.can_manage_tables,
        'can_view_history', rp.can_view_history,
        'can_view_analytics', rp.can_view_analytics,
        'can_view_inventory', rp.can_view_inventory,
        'can_manage_inventory', rp.can_manage_inventory,
        'can_view_branding', rp.can_view_branding,
        'can_manage_branding', rp.can_manage_branding,
        'can_view_account', rp.can_view_account,
        'can_manage_admins', rp.can_manage_admins,
        'can_view_billing', rp.can_view_billing
    ) INTO v_permissions
    FROM public.role_permissions rp
    WHERE rp.role = v_role;

    RETURN COALESCE(v_permissions, '{}'::jsonb);
END;
$$;


-- ─── STEP 6: RLS for role_permissions table ──────────────────────────────────

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Anyone can read role permissions
DROP POLICY IF EXISTS "role_permissions_read" ON public.role_permissions;
CREATE POLICY "role_permissions_read" ON public.role_permissions
    FOR SELECT USING (true);

-- Only super admins can modify
DROP POLICY IF EXISTS "role_permissions_modify" ON public.role_permissions;
CREATE POLICY "role_permissions_modify" ON public.role_permissions
    FOR ALL TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());


-- ─── STEP 7: Comments ────────────────────────────────────────────────────────

COMMENT ON TABLE public.role_permissions IS 'Defines permissions for each role in the RBAC system';
COMMENT ON FUNCTION public.is_role_allowed_for_tier IS 'Checks if a role is allowed for the restaurant subscription tier';
COMMENT ON FUNCTION public.check_admin_limit IS 'Enforces admin limits based on subscription tier';
COMMENT ON FUNCTION public.get_user_permissions IS 'Returns the permissions for the current user';


-- =============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- =============================================================================
-- SELECT * FROM public.role_permissions;
-- SELECT public.get_user_permissions();
-- SELECT public.is_role_allowed_for_tier('staff', 'hotel-mmeklvkh');
