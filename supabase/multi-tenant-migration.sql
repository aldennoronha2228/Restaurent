-- =============================================================================
-- MULTI-TENANT MIGRATION
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================
-- This converts the single-restaurant schema into a full multi-tenant SaaS.
-- Each tenant (restaurant) owns its own isolated rows in every data table.
-- RLS policies ensure a user ONLY sees data belonging to their tenant.
-- =============================================================================


-- ─── STEP 1: Ensure the restaurants (tenants) table and default row exists ──────
-- Already exists from original schema, but adding 'created_at' if missing.

ALTER TABLE public.restaurants
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Insert the default tenant if it was accidentally deleted, avoiding FK failures
INSERT INTO public.restaurants (id, name)
VALUES ('rest001', 'My Restaurant')
ON CONFLICT (id) DO NOTHING;


-- ─── STEP 2: Create user_profiles ────────────────────────────────────────────
-- Links each auth.users row to a tenant (restaurant).
-- This is the single source of truth for "which restaurant does this user manage?"

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id   TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'staff')),
    full_name   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── STEP 3: Add tenant_id to all data tables ────────────────────────────────

-- categories
ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- menu_items (already has category_id FK; keep it, just add tenant_id)
ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- orders (already has restaurant_id; we'll use that AS tenant_id for backward compat)
-- restaurant_id is already a FK to restaurants, so alias it to tenant_id via a view,
-- but for consistency we also alias in queries. No column addition needed.

-- order_items inherit tenant_id through orders JOIN, no column needed.


-- ─── STEP 4: Backfill existing rows → all belong to 'rest001' ────────────────

UPDATE public.categories  SET tenant_id = 'rest001' WHERE tenant_id IS NULL;
UPDATE public.menu_items  SET tenant_id = 'rest001' WHERE tenant_id IS NULL;


-- ─── STEP 5: Make tenant_id NOT NULL now that it is populated ─────────────────

ALTER TABLE public.categories  ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.menu_items  ALTER COLUMN tenant_id SET NOT NULL;


-- ─── STEP 6: Drop the old UNIQUE constraint on name (now unique per tenant) ───

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE public.menu_items DROP CONSTRAINT IF EXISTS menu_items_name_key;

-- Add per-tenant unique constraints instead
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'categories_tenant_name_unique'
    ) THEN
        ALTER TABLE public.categories ADD CONSTRAINT categories_tenant_name_unique UNIQUE (tenant_id, name);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'menu_items_tenant_name_unique'
    ) THEN
        ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_tenant_name_unique UNIQUE (tenant_id, name);
    END IF;
END $$;


-- ─── STEP 7: Helper function — get the calling user's tenant_id ────────────────
-- Called inside RLS USING clauses. Returns NULL for anon.

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


-- ─── STEP 8: Enable RLS on all tables ────────────────────────────────────────

ALTER TABLE public.restaurants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users    ENABLE ROW LEVEL SECURITY;


-- ─── STEP 9: Drop ALL existing policies (clean slate) ─────────────────────────

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


-- ─── STEP 10: New multi-tenant RLS policies ───────────────────────────────────

-- ---- restaurants ----
-- Anyone can read the restaurant they belong to (customer UI needs name/logo).
-- Only service_role can create restaurants (done server-side on signup).
CREATE POLICY "restaurants_auth_select_own"
    ON public.restaurants FOR SELECT TO authenticated
    USING (id = public.get_my_tenant_id());

CREATE POLICY "restaurants_anon_select"
    ON public.restaurants FOR SELECT TO anon
    USING (true);  -- anon needs to see the restaurant name for the customer menu


-- ---- user_profiles ----
-- Users can only read/update their own profile.
CREATE POLICY "user_profiles_select_own"
    ON public.user_profiles FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "user_profiles_update_own"
    ON public.user_profiles FOR UPDATE TO authenticated
    USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- INSERT is done by the server-side signup function (service_role), not by users directly.
-- anon: no access at all.


-- ---- categories ----
-- Authenticated: see/manage only their tenant's categories.
-- Anon: read all categories (customer menu needs them).
CREATE POLICY "categories_auth_tenant_all"
    ON public.categories FOR ALL TO authenticated
    USING    (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "categories_anon_select"
    ON public.categories FOR SELECT TO anon
    USING (true);


-- ---- menu_items ----
-- Authenticated: see/manage only their tenant's items.
-- Anon: read only AVAILABLE items (hides unavailable from customer menu).
CREATE POLICY "menu_items_auth_tenant_all"
    ON public.menu_items FOR ALL TO authenticated
    USING    (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "menu_items_anon_select_available"
    ON public.menu_items FOR SELECT TO anon
    USING (available = true);


-- ---- orders ----
-- Authenticated: see/manage only their tenant's orders.
-- Anon (customer): INSERT only, status must be 'new'.
--   The restaurant_id column serves as the tenant_id for orders.
CREATE POLICY "orders_auth_tenant_all"
    ON public.orders FOR ALL TO authenticated
    USING    (restaurant_id = public.get_my_tenant_id())
    WITH CHECK (restaurant_id = public.get_my_tenant_id());

CREATE POLICY "orders_anon_insert_only"
    ON public.orders FOR INSERT TO anon
    WITH CHECK (status = 'new');

CREATE POLICY "orders_anon_select"
    ON public.orders FOR SELECT TO anon
    USING (status = 'new');


-- ---- order_items ----
-- Authenticated: access items of their tenant's orders only.
-- Anon: INSERT only (no read-back to prevent IDOR).
CREATE POLICY "order_items_auth_tenant_all"
    ON public.order_items FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
              AND o.restaurant_id = public.get_my_tenant_id()
        )
    )
    WITH CHECK (
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


-- ---- admin_users ----
-- Authenticated: select only their own row.
-- anon: no access.
CREATE POLICY "admin_users_auth_select_own"
    ON public.admin_users FOR SELECT TO authenticated
    USING (email = (auth.jwt() ->> 'email'));


-- ─── STEP 11: Realtime publication ───────────────────────────────────────────

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


-- ─── STEP 12: Backfill user_profiles for existing admin_users ────────────────
-- If you have existing users in auth.users who are in admin_users,
-- this links them to 'rest001' automatically.

INSERT INTO public.user_profiles (id, tenant_id, role, full_name)
SELECT
    u.id,
    'rest001',
    'owner',
    a.full_name
FROM auth.users u
JOIN public.admin_users a ON lower(u.email) = lower(a.email)
WHERE a.is_active = true
ON CONFLICT (id) DO NOTHING;


-- ─── STEP 13: site_settings — add tenant_id ──────────────────────────────────
-- site_settings may exist from the prior migration; add tenant_id if missing.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'site_settings'
    ) THEN
        ALTER TABLE public.site_settings
            ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.restaurants(id);
        UPDATE public.site_settings SET tenant_id = 'rest001' WHERE tenant_id IS NULL;
    END IF;
END $$;


-- =============================================================================
-- VERIFICATION QUERIES (run manually after applying)
-- =============================================================================
/*
-- Check all policies
SELECT tablename, policyname, roles, cmd
FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check user_profiles
SELECT * FROM public.user_profiles;

-- Check tenant_id columns exist
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'tenant_id';
*/
