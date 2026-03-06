-- =============================================================================
-- ACCOUNT LIMITS & ROLE RESTRICTIONS - Tier-based Team Limits
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================
-- PURPOSE: Enforce team member limits per subscription tier
-- STARTER: Max 2 team members (owner counts as 1)
-- PRO: Max 10 team members
-- =============================================================================


-- ─── STEP 1: Function to count team members for a tenant ─────────────────────

CREATE OR REPLACE FUNCTION public.count_tenant_members(p_tenant_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.user_profiles
    WHERE tenant_id = p_tenant_id
      AND role IN ('owner', 'admin', 'manager', 'staff');
    
    RETURN COALESCE(v_count, 0);
END;
$$;


-- ─── STEP 2: Function to get team limit for a tenant ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_tenant_team_limit(p_tenant_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier TEXT;
BEGIN
    SELECT subscription_tier INTO v_tier
    FROM public.restaurants
    WHERE id = p_tenant_id;
    
    -- Starter tier: 2 members max
    IF v_tier IN ('starter', '1k') THEN
        RETURN 2;
    END IF;
    
    -- Pro tier: 10 members max
    IF v_tier IN ('pro', '2k', '2.5k') THEN
        RETURN 10;
    END IF;
    
    -- Default (unknown tier): 2 members
    RETURN 2;
END;
$$;


-- ─── STEP 3: Function to check if team can add more members ──────────────────

CREATE OR REPLACE FUNCTION public.can_add_team_member(p_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
    v_limit INTEGER;
BEGIN
    v_count := public.count_tenant_members(p_tenant_id);
    v_limit := public.get_tenant_team_limit(p_tenant_id);
    
    RETURN v_count < v_limit;
END;
$$;


-- ─── STEP 4: Updated trigger function to enforce limits ──────────────────────

CREATE OR REPLACE FUNCTION public.check_admin_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier TEXT;
    v_current_count INT;
    v_limit INT;
BEGIN
    -- Skip check for super_admin (they have no tenant)
    IF NEW.role = 'super_admin' THEN
        RETURN NEW;
    END IF;
    
    -- Skip if no tenant_id
    IF NEW.tenant_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get restaurant's subscription tier
    SELECT subscription_tier INTO v_tier
    FROM public.restaurants
    WHERE id = NEW.tenant_id;

    -- Determine limit based on tier
    IF v_tier IN ('starter', '1k') THEN
        v_limit := 2;
    ELSIF v_tier IN ('pro', '2k', '2.5k') THEN
        v_limit := 10;
    ELSE
        v_limit := 2; -- Default to Starter limits
    END IF;

    -- Count current members (excluding the record being inserted/updated)
    SELECT COUNT(*) INTO v_current_count
    FROM public.user_profiles
    WHERE tenant_id = NEW.tenant_id
      AND role IN ('owner', 'admin', 'manager', 'staff')
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    -- Check if limit would be exceeded
    IF v_current_count >= v_limit THEN
        IF v_tier IN ('starter', '1k') THEN
            RAISE EXCEPTION 'Starter tier allows maximum % team members. Upgrade to Pro for up to 10 staff accounts.', v_limit;
        ELSE
            RAISE EXCEPTION 'Pro tier allows maximum % team members. Contact support if you need more.', v_limit;
        END IF;
    END IF;

    -- Starter tier role restriction: only owner/admin allowed
    IF v_tier IN ('starter', '1k') THEN
        IF NEW.role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Starter tier only supports Owner role. Upgrade to Pro for Manager and Staff roles.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


-- ─── STEP 5: Create/Replace triggers ─────────────────────────────────────────

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS enforce_admin_limit ON public.user_profiles;
DROP TRIGGER IF EXISTS enforce_team_limit ON public.user_profiles;

-- Create trigger for INSERT operations
CREATE TRIGGER enforce_team_limit
    BEFORE INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_admin_limit();

-- Create trigger for UPDATE operations (in case role changes)
CREATE TRIGGER enforce_team_limit_update
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    WHEN (OLD.role IS DISTINCT FROM NEW.role OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id)
    EXECUTE FUNCTION public.check_admin_limit();


-- ─── STEP 6: RLS Policy to prevent bypass via direct API ─────────────────────

-- Policy for user_profiles INSERT - check limits
DROP POLICY IF EXISTS "user_profiles_insert_with_limit" ON public.user_profiles;
CREATE POLICY "user_profiles_insert_with_limit"
    ON public.user_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Super admins can insert anything
        public.is_super_admin()
        OR
        -- Regular users: check if they can add members
        (
            tenant_id IS NOT NULL 
            AND public.can_add_team_member(tenant_id)
        )
    );


-- ─── STEP 7: Grant execute permissions ───────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.count_tenant_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_team_limit TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_team_member TO authenticated;


-- ─── STEP 8: Comments for documentation ──────────────────────────────────────

COMMENT ON FUNCTION public.count_tenant_members IS 'Returns the current number of team members for a restaurant';
COMMENT ON FUNCTION public.get_tenant_team_limit IS 'Returns the max team members allowed based on subscription tier (Starter=2, Pro=10)';
COMMENT ON FUNCTION public.can_add_team_member IS 'Returns true if the restaurant can add more team members';
COMMENT ON FUNCTION public.check_admin_limit IS 'Trigger function to enforce team member limits per subscription tier';


-- =============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- =============================================================================
-- Check a specific restaurant's team capacity:
-- SELECT 
--     r.id,
--     r.name,
--     r.subscription_tier,
--     public.count_tenant_members(r.id) as current_members,
--     public.get_tenant_team_limit(r.id) as max_members,
--     public.can_add_team_member(r.id) as can_add_more
-- FROM public.restaurants r;

-- List all team members per restaurant:
-- SELECT 
--     r.name as restaurant,
--     up.full_name,
--     up.role,
--     r.subscription_tier
-- FROM public.user_profiles up
-- JOIN public.restaurants r ON r.id = up.tenant_id
-- WHERE up.tenant_id IS NOT NULL
-- ORDER BY r.name, up.role;
