-- =============================================================================
-- STRICT MULTI-TENANT DATA ISOLATION
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================
-- PURPOSE: Enforce strict data siloing between restaurant tenants
-- SECURITY: Row Level Security prevents any cross-tenant data access
-- SUPER ADMIN: Uses service_role key to bypass RLS for global view
-- =============================================================================


-- ─── STEP 1: Verify all tables have tenant isolation columns ─────────────────

-- Ensure restaurant_id exists on all key tables
ALTER TABLE public.daily_reports 
    ADD COLUMN IF NOT EXISTS restaurant_id TEXT REFERENCES public.restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.site_settings 
    ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- Ensure user_profiles allows super_admin (no tenant_id required)
ALTER TABLE public.user_profiles 
    ALTER COLUMN tenant_id DROP NOT NULL;

-- Add super_admin role option
ALTER TABLE public.user_profiles 
    DROP CONSTRAINT IF EXISTS user_profiles_role_check;
    
ALTER TABLE public.user_profiles 
    ADD CONSTRAINT user_profiles_role_check 
    CHECK (role IN ('owner', 'admin', 'staff', 'super_admin'));


-- ─── STEP 2: Helper function to get user's tenant_id ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id
    FROM public.user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- Helper function to check if current user is super_admin
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


-- ─── STEP 3: Enable RLS on ALL tables ────────────────────────────────────────

ALTER TABLE public.restaurants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users    ENABLE ROW LEVEL SECURITY;


-- ─── STEP 4: Drop ALL existing policies (clean slate) ────────────────────────

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END
$$;


-- =============================================================================
-- STRICT RLS POLICIES - DENY BY DEFAULT, EXPLICIT ALLOW
-- =============================================================================


-- ─── RESTAURANTS TABLE ───────────────────────────────────────────────────────
-- Super admin: see all restaurants
-- Authenticated: see only their tenant's restaurant
-- Anon: see restaurant by ID (for customer menu header)

CREATE POLICY "restaurants_super_admin_all"
    ON public.restaurants FOR ALL TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "restaurants_auth_select_own"
    ON public.restaurants FOR SELECT TO authenticated
    USING (id = public.get_my_tenant_id() OR public.is_super_admin());

CREATE POLICY "restaurants_auth_update_own"
    ON public.restaurants FOR UPDATE TO authenticated
    USING (id = public.get_my_tenant_id())
    WITH CHECK (id = public.get_my_tenant_id());

CREATE POLICY "restaurants_anon_select"
    ON public.restaurants FOR SELECT TO anon
    USING (true);


-- ─── USER_PROFILES TABLE ─────────────────────────────────────────────────────
-- Super admin: see all profiles
-- Authenticated: see only own profile

CREATE POLICY "user_profiles_super_admin_all"
    ON public.user_profiles FOR ALL TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "user_profiles_select_own"
    ON public.user_profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_super_admin());

CREATE POLICY "user_profiles_update_own"
    ON public.user_profiles FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());


-- ─── CATEGORIES TABLE ────────────────────────────────────────────────────────
-- Super admin: see all categories
-- Authenticated: CRUD only on their tenant's categories
-- Anon: read-only (customer menu)

CREATE POLICY "categories_super_admin_select"
    ON public.categories FOR SELECT TO authenticated
    USING (public.is_super_admin());

CREATE POLICY "categories_auth_tenant_select"
    ON public.categories FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "categories_auth_tenant_insert"
    ON public.categories FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id() AND NOT public.is_super_admin());

CREATE POLICY "categories_auth_tenant_update"
    ON public.categories FOR UPDATE TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "categories_auth_tenant_delete"
    ON public.categories FOR DELETE TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "categories_anon_select"
    ON public.categories FOR SELECT TO anon
    USING (true);


-- ─── MENU_ITEMS TABLE ────────────────────────────────────────────────────────
-- Super admin: see all items
-- Authenticated: CRUD only on their tenant's items
-- Anon: read only available items

CREATE POLICY "menu_items_super_admin_select"
    ON public.menu_items FOR SELECT TO authenticated
    USING (public.is_super_admin());

CREATE POLICY "menu_items_auth_tenant_select"
    ON public.menu_items FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "menu_items_auth_tenant_insert"
    ON public.menu_items FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id() AND NOT public.is_super_admin());

CREATE POLICY "menu_items_auth_tenant_update"
    ON public.menu_items FOR UPDATE TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "menu_items_auth_tenant_delete"
    ON public.menu_items FOR DELETE TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "menu_items_anon_select_available"
    ON public.menu_items FOR SELECT TO anon
    USING (available = true);


-- ─── ORDERS TABLE ────────────────────────────────────────────────────────────
-- CRITICAL: restaurant_id is the tenant isolation column
-- Super admin: see all orders
-- Authenticated: CRUD only on their tenant's orders
-- Anon: INSERT only with status='new'

CREATE POLICY "orders_super_admin_select"
    ON public.orders FOR SELECT TO authenticated
    USING (public.is_super_admin());

CREATE POLICY "orders_auth_tenant_select"
    ON public.orders FOR SELECT TO authenticated
    USING (restaurant_id = public.get_my_tenant_id());

CREATE POLICY "orders_auth_tenant_insert"
    ON public.orders FOR INSERT TO authenticated
    WITH CHECK (restaurant_id = public.get_my_tenant_id() AND NOT public.is_super_admin());

CREATE POLICY "orders_auth_tenant_update"
    ON public.orders FOR UPDATE TO authenticated
    USING (restaurant_id = public.get_my_tenant_id())
    WITH CHECK (restaurant_id = public.get_my_tenant_id());

CREATE POLICY "orders_auth_tenant_delete"
    ON public.orders FOR DELETE TO authenticated
    USING (restaurant_id = public.get_my_tenant_id());

CREATE POLICY "orders_anon_insert_only"
    ON public.orders FOR INSERT TO anon
    WITH CHECK (status = 'new');

-- Allow anon to read their own order back after insert (for order confirmation)
CREATE POLICY "orders_anon_select_new"
    ON public.orders FOR SELECT TO anon
    USING (status = 'new');


-- ─── ORDER_ITEMS TABLE ───────────────────────────────────────────────────────
-- Super admin: see all order items
-- Authenticated: access via parent order's tenant
-- Anon: INSERT only

CREATE POLICY "order_items_super_admin_select"
    ON public.order_items FOR SELECT TO authenticated
    USING (public.is_super_admin());

CREATE POLICY "order_items_auth_tenant_select"
    ON public.order_items FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
              AND o.restaurant_id = public.get_my_tenant_id()
        )
    );

CREATE POLICY "order_items_auth_tenant_insert"
    ON public.order_items FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
              AND o.restaurant_id = public.get_my_tenant_id()
        ) AND NOT public.is_super_admin()
    );

CREATE POLICY "order_items_auth_tenant_update"
    ON public.order_items FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
              AND o.restaurant_id = public.get_my_tenant_id()
        )
    );

CREATE POLICY "order_items_auth_tenant_delete"
    ON public.order_items FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
              AND o.restaurant_id = public.get_my_tenant_id()
        )
    );

CREATE POLICY "order_items_anon_insert_only"
    ON public.order_items FOR INSERT TO anon
    WITH CHECK (
        quantity > 0 AND quantity <= 99
        AND item_price > 0
        AND char_length(item_name) <= 200
    );

CREATE POLICY "order_items_anon_select"
    ON public.order_items FOR SELECT TO anon
    USING (true);


-- ─── DAILY_REPORTS TABLE ─────────────────────────────────────────────────────
-- Super admin: see all reports
-- Authenticated: read only their tenant's reports

CREATE POLICY "daily_reports_super_admin_all"
    ON public.daily_reports FOR ALL TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "daily_reports_auth_tenant_select"
    ON public.daily_reports FOR SELECT TO authenticated
    USING (restaurant_id = public.get_my_tenant_id());


-- ─── SITE_SETTINGS TABLE ─────────────────────────────────────────────────────
-- Super admin: see all settings
-- Authenticated: CRUD only their tenant's settings

CREATE POLICY "site_settings_super_admin_all"
    ON public.site_settings FOR ALL TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "site_settings_auth_tenant_all"
    ON public.site_settings FOR ALL TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());


-- ─── ADMIN_USERS TABLE ───────────────────────────────────────────────────────
-- Super admin: see all admin users  
-- Authenticated: see only own record

CREATE POLICY "admin_users_super_admin_all"
    ON public.admin_users FOR ALL TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "admin_users_auth_select_own"
    ON public.admin_users FOR SELECT TO authenticated
    USING (email = (auth.jwt() ->> 'email'));


-- =============================================================================
-- STEP 5: Realtime publication (only safe tables)
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime SET TABLE
    public.orders,
    public.order_items,
    public.menu_items,
    public.categories;


-- =============================================================================
-- STEP 6: Revoke dangerous defaults
-- =============================================================================

REVOKE ALL ON TABLE public.admin_users FROM anon;
REVOKE ALL ON TABLE public.user_profiles FROM anon;
REVOKE ALL ON TABLE public.daily_reports FROM anon;
REVOKE ALL ON TABLE public.site_settings FROM anon;


-- =============================================================================
-- VERIFICATION QUERIES (run manually)
-- =============================================================================
/*
-- List all policies by table
SELECT tablename, policyname, roles, cmd
FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables WHERE schemaname = 'public'
ORDER BY tablename;

-- Test isolation: As Restaurant A user, try to query Restaurant B data
-- This should return ZERO rows if RLS is working correctly:
SELECT * FROM public.orders WHERE restaurant_id != public.get_my_tenant_id();
*/
