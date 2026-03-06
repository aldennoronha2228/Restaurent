/**
 * POST /api/tenant/create
 * -----------------------
 * Server-side endpoint that creates a new restaurant (tenant) and links the
 * auth user to it via user_profiles. Uses the service_role key so it can
 * bypass RLS — this file is NEVER sent to the browser.
 *
 * Body: { userId, email, fullName, restaurantName, masterPin }
 * Returns: { tenantId }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase environment variables');
    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, email, fullName, restaurantName, masterPin } = body;

        if (!userId || !email || !restaurantName || !masterPin) {
            return NextResponse.json({ error: 'Missing required fields (including master PIN)' }, { status: 400 });
        }

        // Validate master PIN format (4-8 digits or alphanumeric)
        if (masterPin.length < 4 || masterPin.length > 20) {
            return NextResponse.json({ error: 'Master PIN must be 4-20 characters' }, { status: 400 });
        }

        const supabaseAdmin = getServiceClient();

        // Generate a unique tenant ID from the restaurant name
        const baseSlug = slugify(restaurantName) || 'restaurant';
        const tenantId = `${baseSlug}-${Date.now().toString(36)}`;

        // 1. Create the restaurant (tenant) with master PIN
        const { error: restaurantError } = await supabaseAdmin
            .from('restaurants')
            .insert([{ id: tenantId, name: restaurantName, master_pin: masterPin }]);

        if (restaurantError) {
            console.error('[tenant/create] Restaurant insert error:', restaurantError);
            return NextResponse.json(
                { error: `Could not create restaurant: ${restaurantError.message}` },
                { status: 500 }
            );
        }

        // 2. Add the user to admin_users (preserves backward compat with checkIsAdmin)
        await supabaseAdmin
            .from('admin_users')
            .insert([{ email: email.toLowerCase().trim(), full_name: fullName, is_active: true }])
            .select();
        // Non-fatal: existing admin entries are fine

        // 3. Create user_profile linking user → tenant
        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert([{
                id: userId,
                tenant_id: tenantId,
                role: 'owner',
                full_name: fullName,
            }]);

        if (profileError) {
            // Rollback: delete the restaurant we just created
            await supabaseAdmin.from('restaurants').delete().eq('id', tenantId);
            console.error('[tenant/create] Profile insert error:', profileError);
            return NextResponse.json(
                { error: `Could not create user profile: ${profileError.message}` },
                { status: 500 }
            );
        }

        // 4. Seed default categories for this tenant
        const defaultCategories = [
            { name: 'Appetizers', display_order: 1, tenant_id: tenantId },
            { name: 'Main Course', display_order: 2, tenant_id: tenantId },
            { name: 'Desserts', display_order: 3, tenant_id: tenantId },
            { name: 'Beverages', display_order: 4, tenant_id: tenantId },
        ];

        await supabaseAdmin.from('categories').insert(defaultCategories);
        // Non-fatal: if this fails the user can add categories manually

        return NextResponse.json({ tenantId, restaurantName }, { status: 201 });
    } catch (err: any) {
        console.error('[tenant/create] Unexpected error:', err);
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
