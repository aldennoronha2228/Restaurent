-- ============================================================
-- Daily Reports Schema for Pro Tier
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. DAILY REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    
    -- Key Metrics
    total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_orders INT NOT NULL DEFAULT 0,
    avg_order_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    
    -- Top Items (JSON array of {name, quantity, revenue})
    top_items JSONB DEFAULT '[]'::jsonb,
    
    -- Hourly breakdown (JSON object {hour: order_count})
    hourly_breakdown JSONB DEFAULT '{}'::jsonb,
    busiest_hour INT, -- 0-23
    
    -- Additional stats
    new_customers INT DEFAULT 0,
    repeat_customers INT DEFAULT 0,
    cancelled_orders INT DEFAULT 0,
    
    -- Metadata
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(restaurant_id, report_date)
);

-- 2. ADD last_report_date TO RESTAURANTS
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS last_report_date DATE,
ADD COLUMN IF NOT EXISTS email_reports_enabled BOOLEAN DEFAULT false;

-- 3. Enable RLS
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for daily_reports
DROP POLICY IF EXISTS "reports_read_own" ON public.daily_reports;
DROP POLICY IF EXISTS "reports_insert_service" ON public.daily_reports;
DROP POLICY IF EXISTS "reports_read_service" ON public.daily_reports;

-- Restaurant owners can read their own reports
CREATE POLICY "reports_read_own" ON public.daily_reports 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.tenant_id = daily_reports.restaurant_id
        )
    );

-- Service role can do everything (for report generation)
CREATE POLICY "reports_insert_service" ON public.daily_reports 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "reports_read_service" ON public.daily_reports 
    FOR SELECT 
    USING (true);

-- 5. Index for fast queries
CREATE INDEX IF NOT EXISTS idx_daily_reports_restaurant_date 
    ON public.daily_reports(restaurant_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_reports_date 
    ON public.daily_reports(report_date DESC);

-- 6. Function to generate daily report for a restaurant
CREATE OR REPLACE FUNCTION generate_daily_report(p_restaurant_id TEXT, p_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS UUID AS $$
DECLARE
    v_report_id UUID;
    v_total_revenue NUMERIC(12,2);
    v_total_orders INT;
    v_avg_order_value NUMERIC(10,2);
    v_top_items JSONB;
    v_hourly_breakdown JSONB;
    v_busiest_hour INT;
    v_cancelled_orders INT;
BEGIN
    -- Calculate total revenue and orders
    SELECT 
        COALESCE(SUM(total), 0),
        COUNT(*),
        COALESCE(AVG(total), 0),
        COUNT(*) FILTER (WHERE status = 'cancelled')
    INTO v_total_revenue, v_total_orders, v_avg_order_value, v_cancelled_orders
    FROM public.orders
    WHERE restaurant_id = p_restaurant_id
    AND DATE(created_at) = p_date
    AND status != 'cancelled';

    -- Get top 5 items
    SELECT COALESCE(jsonb_agg(item_data), '[]'::jsonb)
    INTO v_top_items
    FROM (
        SELECT jsonb_build_object(
            'name', oi.item_name,
            'quantity', SUM(oi.quantity),
            'revenue', SUM(oi.item_price * oi.quantity)
        ) as item_data
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE o.restaurant_id = p_restaurant_id
        AND DATE(o.created_at) = p_date
        AND o.status != 'cancelled'
        GROUP BY oi.item_name
        ORDER BY SUM(oi.quantity) DESC
        LIMIT 5
    ) sub;

    -- Get hourly breakdown
    SELECT COALESCE(jsonb_object_agg(hour, cnt), '{}'::jsonb)
    INTO v_hourly_breakdown
    FROM (
        SELECT EXTRACT(HOUR FROM created_at)::TEXT as hour, COUNT(*) as cnt
        FROM public.orders
        WHERE restaurant_id = p_restaurant_id
        AND DATE(created_at) = p_date
        AND status != 'cancelled'
        GROUP BY EXTRACT(HOUR FROM created_at)
    ) sub;

    -- Find busiest hour
    SELECT (key::INT)
    INTO v_busiest_hour
    FROM jsonb_each_text(v_hourly_breakdown)
    ORDER BY value::INT DESC
    LIMIT 1;

    -- Insert or update report
    INSERT INTO public.daily_reports (
        restaurant_id,
        report_date,
        total_revenue,
        total_orders,
        avg_order_value,
        top_items,
        hourly_breakdown,
        busiest_hour,
        cancelled_orders
    ) VALUES (
        p_restaurant_id,
        p_date,
        v_total_revenue,
        v_total_orders,
        v_avg_order_value,
        v_top_items,
        v_hourly_breakdown,
        v_busiest_hour,
        v_cancelled_orders
    )
    ON CONFLICT (restaurant_id, report_date) 
    DO UPDATE SET
        total_revenue = EXCLUDED.total_revenue,
        total_orders = EXCLUDED.total_orders,
        avg_order_value = EXCLUDED.avg_order_value,
        top_items = EXCLUDED.top_items,
        hourly_breakdown = EXCLUDED.hourly_breakdown,
        busiest_hour = EXCLUDED.busiest_hour,
        cancelled_orders = EXCLUDED.cancelled_orders,
        generated_at = NOW()
    RETURNING id INTO v_report_id;

    -- Update restaurant's last_report_date
    UPDATE public.restaurants 
    SET last_report_date = p_date 
    WHERE id = p_restaurant_id;

    RETURN v_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant execute permission
GRANT EXECUTE ON FUNCTION generate_daily_report TO service_role;
