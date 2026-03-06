import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * /api/admin/confirm-user
 * -----------------------
 * EMERGENCY TOOL: Manually confirms a Supabase user if they aren't receiving the email.
 * This uses the 'supabaseAdmin' (Service Role) client to bypass RLS and Auth requirements.
 * 
 * SECURITY: Protected by the tenant's master_pin (set during signup).
 */

async function verifyTenantPin(email: string, providedPin: string): Promise<{ valid: boolean; reason?: string }> {
    // Find the user's tenant via user_profiles + restaurants
    const { data: profile, error: profileErr } = await supabaseAdmin
        .from('admin_users')
        .select('email')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();
    
    if (profileErr || !profile) {
        // User not in admin_users yet - check if they have a user_profile
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const user = users?.users.find(u => u.email?.toLowerCase() === email.toLowerCase().trim());
        
        if (!user) {
            return { valid: false, reason: 'User not found' };
        }
        
        // Get user's tenant from user_profiles
        const { data: userProfile } = await supabaseAdmin
            .from('user_profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .maybeSingle();
            
        if (!userProfile?.tenant_id) {
            return { valid: false, reason: 'No tenant found for user' };
        }
        
        // Get the restaurant's master_pin
        const { data: restaurant } = await supabaseAdmin
            .from('restaurants')
            .select('master_pin')
            .eq('id', userProfile.tenant_id)
            .maybeSingle();
            
        if (!restaurant?.master_pin) {
            return { valid: false, reason: 'No master PIN configured for this restaurant' };
        }
        
        return { valid: restaurant.master_pin === providedPin };
    }
    
    // Find the user in auth to get their user_profile
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users.find(u => u.email?.toLowerCase() === email.toLowerCase().trim());
    
    if (!user) {
        return { valid: false, reason: 'User not found in auth' };
    }
    
    const { data: userProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .maybeSingle();
        
    if (!userProfile?.tenant_id) {
        return { valid: false, reason: 'No tenant found' };
    }
    
    const { data: restaurant } = await supabaseAdmin
        .from('restaurants')
        .select('master_pin')
        .eq('id', userProfile.tenant_id)
        .maybeSingle();
        
    if (!restaurant?.master_pin) {
        return { valid: false, reason: 'No master PIN set' };
    }
    
    return { valid: restaurant.master_pin === providedPin };
}

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();
        const providedPin = (req.headers.get('x-admin-key') || '').trim();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }
        
        if (!providedPin) {
            return NextResponse.json({ error: 'Master PIN is required' }, { status: 400 });
        }

        console.log(`[ConfirmUser] Manually confirming email: ${email}`);

        // 1. Find the user in the auth system
        const { data: { users }, error: findError } = await supabaseAdmin.auth.admin.listUsers();

        if (findError) throw findError;

        const user = users.find(u => u.email === email);

        if (!user) {
            return NextResponse.json({ error: 'User not found in Supabase Auth' }, { status: 404 });
        }
        
        // 2. Verify the master PIN against the user's tenant
        const pinCheck = await verifyTenantPin(email, providedPin);
        if (!pinCheck.valid) {
            return NextResponse.json({ error: pinCheck.reason || 'Invalid Master PIN' }, { status: 401 });
        }

        // 3. Update the user to mark their email as confirmed
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { email_confirm: true }
        );

        if (updateError) throw updateError;

        return NextResponse.json({
            message: `Successfully confirmed ${email}! You can now sign in.`,
            userId: user.id
        });

    } catch (err: any) {
        console.error('[ConfirmUser] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
