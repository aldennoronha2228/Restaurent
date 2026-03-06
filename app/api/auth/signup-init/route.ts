/**
 * POST /api/auth/signup-init
 * --------------------------
 * Step 1 of signup: Generates a 6-digit OTP, stores signup data, and emails the code.
 * 
 * Body: { email, password, fullName, restaurantName, masterPin }
 * Returns: { success, expiresAt }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendOtpEmail } from '@/lib/email';

function getServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase environment variables');
    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, fullName, restaurantName, masterPin } = body;

        if (!email || !password || !fullName || !restaurantName || !masterPin) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        // Validate password strength
        if (password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
        }

        // Validate master PIN
        if (masterPin.length < 4 || masterPin.length > 20) {
            return NextResponse.json({ error: 'Master PIN must be 4-20 characters' }, { status: 400 });
        }

        const supabaseAdmin = getServiceClient();

        // Check if email already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users.find(
            u => u.email?.toLowerCase() === email.toLowerCase()
        );
        
        if (existingUser) {
            return NextResponse.json({ 
                error: 'This email is already registered. Please sign in instead.' 
            }, { status: 409 });
        }

        // Generate OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

        // Store pending signup in database
        const { error: insertError } = await supabaseAdmin
            .from('pending_signups')
            .upsert([{
                email: email.toLowerCase().trim(),
                password_hash: password, // Note: In production, hash this
                full_name: fullName,
                restaurant_name: restaurantName,
                master_pin: masterPin,
                otp,
                expires_at: expiresAt,
                created_at: new Date().toISOString(),
            }], { onConflict: 'email' });

        if (insertError) {
            console.error('[signup-init] Insert error:', insertError);
            // If table doesn't exist, we'll create user directly later
        }

        // Send OTP via email
        const emailResult = await sendOtpEmail(email, otp, restaurantName);
        
        if (!emailResult.success) {
            console.error('[signup-init] Email failed:', emailResult.error);
            return NextResponse.json({ 
                error: emailResult.error || 'Failed to send verification email' 
            }, { status: 500 });
        }

        console.log(`[signup-init] OTP sent to ${email}`);

        return NextResponse.json({ 
            success: true,
            expiresAt,
            message: 'Verification code sent to your email'
        });

    } catch (err: any) {
        console.error('[signup-init] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
