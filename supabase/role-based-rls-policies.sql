-- =============================================================================
-- ROLE-BASED RLS POLICIES - Security Data Silo
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================
-- PURPOSE: Ensure that even if a Staff/Manager finds a URL, the database
-- returns 403 Forbidden because their role isn't authorized to query that table
-- =============================================================================


-- ─── STEP 1: Helper function to get user's role ──────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM public.user_profiles
    WHERE id = auth.uid();
    
    RETURN COALESCE(v_role, 'staff');
END;
$$;


-- ─── STEP 2: Helper function to check specific permission ────────────────────

CREATE OR REPLACE FUNCTION public.user_has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
BEGIN
    v_role := public.get_user_role();
    
    -- Owner has all permissions
    IF v_role IN ('owner', 'admin', 'super_admin') THEN
        RETURN TRUE;
    END IF;
    
    -- Manager permissions (everything except analytics, billing)
    IF v_role = 'manager' THEN
        IF p_permission IN ('can_view_analytics', 'can_view_billing', 'can_manage_admins') THEN
            RETURN FALSE;
        END IF;
        RETURN TRUE;
    END IF;
    
    -- Staff permissions (only orders and tables)
    IF v_role = 'staff' THEN
        IF p_permission IN ('can_view_orders', 'can_manage_orders', 'can_view_tables') THEN
            RETURN TRUE;
        END IF;
        RETURN FALSE;
    END IF;
    
    RETURN FALSE;
END;
$$;


-- ─── STEP 3: Analytics table policy (Owner only) ─────────────────────────────
-- Only owners can view analytics data
-- Note: Only runs if analytics table exists

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'analytics') THEN
        EXECUTE 'DROP POLICY IF EXISTS "analytics_owner_only" ON public.analytics';
        EXECUTE 'DROP POLICY IF EXISTS "analytics_role_based" ON public.analytics';
        EXECUTE 'CREATE POLICY "analytics_role_based" ON public.analytics
            FOR ALL 
            TO authenticated
            USING (public.user_has_permission(''can_view_analytics''))';
    END IF;
END $$;


-- ─── STEP 4: Orders table policy (All roles can view) ────────────────────────
-- Note: Only applies if orders table has restaurant_id column

DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'restaurant_id'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS "orders_role_based_select" ON public.orders';
        EXECUTE 'DROP POLICY IF EXISTS "orders_role_based_insert" ON public.orders';
        EXECUTE 'DROP POLICY IF EXISTS "orders_role_based_update" ON public.orders';
        
        -- Orders SELECT: All staff can view orders for their tenant
        EXECUTE 'CREATE POLICY "orders_role_based_select"
            ON public.orders
            FOR SELECT
            TO authenticated
            USING (
                (restaurant_id IN (
                    SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()
                ))
                AND public.user_has_permission(''can_view_orders'')
            )';

        -- Orders INSERT: Staff and above can create orders
        EXECUTE 'CREATE POLICY "orders_role_based_insert"
            ON public.orders
            FOR INSERT
            TO authenticated
            WITH CHECK (
                (restaurant_id IN (
                    SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()
                ))
                AND public.user_has_permission(''can_manage_orders'')
            )';

        -- Orders UPDATE: Staff and above can update orders
        EXECUTE 'CREATE POLICY "orders_role_based_update"
            ON public.orders
            FOR UPDATE
            TO authenticated
            USING (
                (restaurant_id IN (
                    SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()
                ))
                AND public.user_has_permission(''can_manage_orders'')
            )';
    END IF;
END $$;


-- ─── STEP 5: Menu items policy (Manager and Owner only) ──────────────────────
-- Note: Only applies if menu_items table has restaurant_id column for multi-tenancy
-- If menu_items is a shared table without tenant column, skip tenant isolation

DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'menu_items' 
        AND column_name = 'restaurant_id'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS "menu_items_role_based_select" ON public.menu_items';
        EXECUTE 'DROP POLICY IF EXISTS "menu_items_role_based_modify" ON public.menu_items';
        
        -- Menu SELECT: Managers and owners can view menu (with tenant isolation)
        EXECUTE 'CREATE POLICY "menu_items_role_based_select"
            ON public.menu_items
            FOR SELECT
            TO authenticated
            USING (
                (restaurant_id IN (
                    SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()
                ))
                AND public.user_has_permission(''can_view_menu'')
            )';

        -- Menu INSERT/UPDATE/DELETE: Only those with manage permission
        EXECUTE 'CREATE POLICY "menu_items_role_based_modify"
            ON public.menu_items
            FOR ALL
            TO authenticated
            USING (
                (restaurant_id IN (
                    SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()
                ))
                AND public.user_has_permission(''can_manage_menu'')
            )
            WITH CHECK (
                (restaurant_id IN (
                    SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()
                ))
                AND public.user_has_permission(''can_manage_menu'')
            )';
    ELSE
        -- Menu items without tenant column - just use permission-based policies
        RAISE NOTICE 'menu_items table does not have restaurant_id column - skipping tenant isolation';
    END IF;
END $$;


-- ─── STEP 6: User profiles policy (tenant isolation) ─────────────────────────

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles') THEN
        EXECUTE 'DROP POLICY IF EXISTS "user_profiles_role_based" ON public.user_profiles';
        EXECUTE 'DROP POLICY IF EXISTS "user_profiles_tenant_isolation" ON public.user_profiles';
        
        -- Users can only see profiles from their own tenant
            EXECUTE 'CREATE POLICY "user_profiles_tenant_isolation"
                ON public.user_profiles
                FOR SELECT
                TO authenticated
                USING (
                    EXISTS (
                        SELECT 1 FROM public.user_profiles AS up
                        WHERE up.id = auth.uid() AND up.tenant_id = tenant_id
                    )
                )';
    END IF;
END $$;


-- ─── STEP 7: Admin users policy (Owner only for management) ──────────────────

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_users') THEN
        EXECUTE 'DROP POLICY IF EXISTS "admin_users_role_based" ON public.admin_users';
        EXECUTE 'DROP POLICY IF EXISTS "admin_users_owner_only" ON public.admin_users';
        
        -- Only owners can manage admin list
        EXECUTE 'CREATE POLICY "admin_users_owner_only"
            ON public.admin_users
            FOR ALL
            TO authenticated
            USING (public.user_has_permission(''can_manage_admins''))
            WITH CHECK (public.user_has_permission(''can_manage_admins''))';
    END IF;
END $$;


-- ─── STEP 8: Grant execute permissions ───────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.get_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission TO authenticated;


-- ─── STEP 9: Comments for documentation ──────────────────────────────────────

COMMENT ON FUNCTION public.get_user_role IS 'Returns the role of the current authenticated user';
COMMENT ON FUNCTION public.user_has_permission IS 'Checks if the current user has a specific permission based on their role';


-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Test your role:
-- SELECT public.get_user_role();

-- Test a permission:
-- SELECT public.user_has_permission('can_view_analytics');

-- List all user roles in your tenant:
-- SELECT id, tenant_id, role, full_name 
-- FROM public.user_profiles 
-- WHERE tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid());
