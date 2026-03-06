/**
 * POST /api/auth/signup-verify
 * ----------------------------
 * Step 2 of signup: Verifies the OTP and creates the actual account.
 * Creates user with email auto-confirmed (no email verification needed).
 * 
 * Body: { email, otp }
 * Returns: { userId, tenantId }
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
        const { email, otp } = body;

        if (!email || !otp) {
            return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
        }

        const supabaseAdmin = getServiceClient();

        // Get pending signup
        const { data: pending, error: fetchError } = await supabaseAdmin
            .from('pending_signups')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .maybeSingle();

        if (fetchError || !pending) {
            return NextResponse.json({ 
                error: 'No pending signup found. Please start over.' 
            }, { status: 404 });
        }

        // Verify OTP
        if (pending.otp !== otp) {
            return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 });
        }

        // Check expiry
        if (new Date(pending.expires_at) < new Date()) {
            // Clean up expired signup
            await supabaseAdmin.from('pending_signups').delete().eq('email', email.toLowerCase().trim());
            return NextResponse.json({ 
                error: 'Verification code expired. Please start over.' 
            }, { status: 410 });
        }

        // Create the user with email_confirm: true (no email verification needed!)
        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: pending.email,
            password: pending.password_hash,
            email_confirm: true, // Auto-confirm email
            user_metadata: { full_name: pending.full_name },
        });

        if (createError) {
            console.error('[signup-verify] Create user error:', createError);
            return NextResponse.json({ error: createError.message }, { status: 500 });
        }

        if (!userData.user) {
            return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
        }

        const userId = userData.user.id;

        // Generate tenant ID
        const baseSlug = slugify(pending.restaurant_name) || 'restaurant';
        const tenantId = `${baseSlug}-${Date.now().toString(36)}`;

        // Create restaurant
        const { error: restaurantError } = await supabaseAdmin
            .from('restaurants')
            .insert([{ 
                id: tenantId, 
                name: pending.restaurant_name,
                master_pin: pending.master_pin 
            }]);

        if (restaurantError) {
            // Rollback: delete the user
            await supabaseAdmin.auth.admin.deleteUser(userId);
            console.error('[signup-verify] Restaurant error:', restaurantError);
            return NextResponse.json({ error: restaurantError.message }, { status: 500 });
        }

        // Add to admin_users
        await supabaseAdmin
            .from('admin_users')
            .insert([{ 
                email: pending.email, 
                full_name: pending.full_name, 
                is_active: true 
            }])
            .select();

        // Create user_profile
        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert([{
                id: userId,
                tenant_id: tenantId,
                role: 'owner',
                full_name: pending.full_name,
            }]);

        if (profileError) {
            // Rollback
            await supabaseAdmin.from('restaurants').delete().eq('id', tenantId);
            await supabaseAdmin.auth.admin.deleteUser(userId);
            console.error('[signup-verify] Profile error:', profileError);
            return NextResponse.json({ error: profileError.message }, { status: 500 });
        }

        // Seed default categories
        const defaultCategories = [
            { name: 'Appetizers', display_order: 1, tenant_id: tenantId },
            { name: 'Main Course', display_order: 2, tenant_id: tenantId },
            { name: 'Desserts', display_order: 3, tenant_id: tenantId },
            { name: 'Beverages', display_order: 4, tenant_id: tenantId },
        ];
        await supabaseAdmin.from('categories').insert(defaultCategories);

        // Clean up pending signup
        await supabaseAdmin.from('pending_signups').delete().eq('email', pending.email);

        console.log(`[signup-verify] Created user ${userId} for tenant ${tenantId}`);

        return NextResponse.json({ 
            userId, 
            tenantId,
            message: 'Account created successfully! You can now sign in.'
        }, { status: 201 });

    } catch (err: any) {
        console.error('[signup-verify] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
