export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/debug/auth
 * Diagnostic endpoint - checks env vars and DB connectivity.
 * REMOVE AFTER DEBUGGING.
 */
export async function GET(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Check env vars (never expose full key, just presence + first 10 chars)
    const envCheck = {
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? `✅ Set: ${supabaseUrl}` : '❌ MISSING',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey ? `✅ Set (${anonKey.substring(0, 15)}...)` : '❌ MISSING',
        SUPABASE_SERVICE_ROLE_KEY: serviceKey ? `✅ Set (${serviceKey.substring(0, 15)}...)` : '❌ MISSING - THIS IS THE PROBLEM',
    };

    let dbCheck = 'Not attempted (missing env vars)';
    let adminUsersCheck = 'Not attempted';
    let userProfilesCheck = 'Not attempted';

    if (supabaseUrl && serviceKey) {
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const client = createClient(supabaseUrl, serviceKey, {
                auth: { persistSession: false },
            });

            // Check admin_users for the super admin email
            const { data: adminData, error: adminError } = await client
                .from('admin_users')
                .select('email, role, is_active')
                .eq('email', 'aldennoronhaschool@gmail.com')
                .maybeSingle();

            if (adminError) {
                adminUsersCheck = `❌ Error: ${adminError.message}`;
            } else if (adminData) {
                adminUsersCheck = `✅ Found: role=${adminData.role}, is_active=${adminData.is_active}`;
            } else {
                adminUsersCheck = `❌ NOT FOUND in admin_users table for aldennoronhaschool@gmail.com`;
            }

            // Check user_profiles for any super_admin role
            const { data: profileData, error: profileError } = await client
                .from('user_profiles')
                .select('id, role, tenant_id, full_name')
                .eq('role', 'super_admin')
                .limit(3);

            if (profileError) {
                userProfilesCheck = `❌ Error: ${profileError.message}`;
            } else if (profileData && profileData.length > 0) {
                userProfilesCheck = `✅ Found ${profileData.length} super_admin(s) in user_profiles`;
            } else {
                userProfilesCheck = `❌ No super_admin found in user_profiles`;
            }

            dbCheck = '✅ DB connection working';
        } catch (err: any) {
            dbCheck = `❌ DB error: ${err.message}`;
        }
    }

    return NextResponse.json({
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        envCheck,
        dbCheck,
        adminUsersCheck,
        userProfilesCheck,
        fix: 'Run the SQL from the Supabase SQL Editor to fix the database records',
    }, { status: 200 });
}
