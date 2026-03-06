import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/reports
 * Fetch daily reports for a restaurant
 * Query params: restaurantId, startDate, endDate, limit
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurantId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '30');

    if (!restaurantId) {
        return NextResponse.json({ error: 'restaurantId required' }, { status: 400 });
    }

    // Verify user token
    const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
    });

    // Verify user belongs to this restaurant and has Pro tier
    const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

    if (!profile || profile.tenant_id !== restaurantId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check subscription tier
    const { data: restaurant } = await serviceClient
        .from('restaurants')
        .select('subscription_tier')
        .eq('id', restaurantId)
        .single();

    const isPro = restaurant?.subscription_tier === 'pro' || 
                  restaurant?.subscription_tier === '2k' || 
                  restaurant?.subscription_tier === '2.5k';

    if (!isPro) {
        return NextResponse.json({ 
            error: 'Reports are a Pro feature',
            upgrade: true 
        }, { status: 403 });
    }

    // Fetch reports
    let query = serviceClient
        .from('daily_reports')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('report_date', { ascending: false })
        .limit(limit);

    if (startDate) {
        query = query.gte('report_date', startDate);
    }
    if (endDate) {
        query = query.lte('report_date', endDate);
    }

    const { data: reports, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reports });
}

/**
 * POST /api/reports/generate
 * Generate a daily report for a specific date
 */
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { restaurantId, date } = body;

    if (!restaurantId) {
        return NextResponse.json({ error: 'restaurantId required' }, { status: 400 });
    }

    // Verify user token
    const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
    });

    // Verify user belongs to this restaurant
    const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

    if (!profile || profile.tenant_id !== restaurantId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check subscription tier
    const { data: restaurant } = await serviceClient
        .from('restaurants')
        .select('subscription_tier, name')
        .eq('id', restaurantId)
        .single();

    const isPro = restaurant?.subscription_tier === 'pro' || 
                  restaurant?.subscription_tier === '2k' || 
                  restaurant?.subscription_tier === '2.5k';

    if (!isPro) {
        return NextResponse.json({ 
            error: 'Reports are a Pro feature',
            upgrade: true 
        }, { status: 403 });
    }

    // Generate report using raw query (the function may not exist yet, so we'll do it manually)
    const reportDate = date || new Date(Date.now() - 86400000).toISOString().split('T')[0]; // Yesterday by default

    // Calculate metrics from orders
    const { data: orders } = await serviceClient
        .from('orders')
        .select('id, total, status, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', `${reportDate}T00:00:00`)
        .lt('created_at', `${reportDate}T23:59:59`);

    const validOrders = orders?.filter(o => o.status !== 'cancelled') || [];
    const cancelledOrders = orders?.filter(o => o.status === 'cancelled').length || 0;
    const totalRevenue = validOrders.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);
    const totalOrders = validOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Get hourly breakdown
    const hourlyBreakdown: Record<string, number> = {};
    validOrders.forEach(order => {
        const hour = new Date(order.created_at).getHours();
        hourlyBreakdown[hour] = (hourlyBreakdown[hour] || 0) + 1;
    });

    // Find busiest hour
    let busiestHour: number | null = null;
    let maxOrders = 0;
    Object.entries(hourlyBreakdown).forEach(([hour, count]) => {
        if (count > maxOrders) {
            maxOrders = count;
            busiestHour = parseInt(hour);
        }
    });

    // Get top items
    const orderIds = validOrders.map(o => o.id);
    let topItems: { name: string; quantity: number; revenue: number }[] = [];
    
    if (orderIds.length > 0) {
        const { data: orderItems } = await serviceClient
            .from('order_items')
            .select('item_name, item_price, quantity')
            .in('order_id', orderIds);

        if (orderItems) {
            const itemMap: Record<string, { quantity: number; revenue: number }> = {};
            orderItems.forEach(item => {
                if (!itemMap[item.item_name]) {
                    itemMap[item.item_name] = { quantity: 0, revenue: 0 };
                }
                itemMap[item.item_name].quantity += item.quantity;
                itemMap[item.item_name].revenue += parseFloat(item.item_price) * item.quantity;
            });

            topItems = Object.entries(itemMap)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 5);
        }
    }

    // Upsert report
    const { data: report, error } = await serviceClient
        .from('daily_reports')
        .upsert({
            restaurant_id: restaurantId,
            report_date: reportDate,
            total_revenue: totalRevenue,
            total_orders: totalOrders,
            avg_order_value: avgOrderValue,
            top_items: topItems,
            hourly_breakdown: hourlyBreakdown,
            busiest_hour: busiestHour,
            cancelled_orders: cancelledOrders,
            generated_at: new Date().toISOString(),
        }, {
            onConflict: 'restaurant_id,report_date'
        })
        .select()
        .single();

    if (error) {
        console.error('Report generation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update restaurant's last_report_date
    await serviceClient
        .from('restaurants')
        .update({ last_report_date: reportDate })
        .eq('id', restaurantId);

    return NextResponse.json({ 
        report,
        restaurantName: restaurant?.name 
    });
}
