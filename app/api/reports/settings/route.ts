import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/reports/settings
 * Get report settings for a restaurant
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurantId');

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

    // Get restaurant settings
    const { data: restaurant, error } = await serviceClient
        .from('restaurants')
        .select('email_reports_enabled, subscription_tier')
        .eq('id', restaurantId)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const isPro = restaurant?.subscription_tier === 'pro' || 
                  restaurant?.subscription_tier === '2k' || 
                  restaurant?.subscription_tier === '2.5k';

    return NextResponse.json({
        emailReportsEnabled: restaurant?.email_reports_enabled ?? false,
        isPro,
    });
}

/**
 * POST /api/reports/settings
 * Update report settings for a restaurant
 */
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { restaurantId, emailReportsEnabled } = body;

    if (!restaurantId || typeof emailReportsEnabled !== 'boolean') {
        return NextResponse.json({ error: 'restaurantId and emailReportsEnabled required' }, { status: 400 });
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

    // Verify user belongs to this restaurant and is owner
    const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

    if (!profile || profile.tenant_id !== restaurantId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (profile.role !== 'owner') {
        return NextResponse.json({ error: 'Only owners can change report settings' }, { status: 403 });
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
            error: 'Email Reports are a Pro feature',
            upgrade: true 
        }, { status: 403 });
    }

    // Update setting
    const { error } = await serviceClient
        .from('restaurants')
        .update({ email_reports_enabled: emailReportsEnabled })
        .eq('id', restaurantId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, emailReportsEnabled });
}
