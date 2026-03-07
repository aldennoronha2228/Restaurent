/**
 * lib/auth.ts  (multi-tenant)
 * ----------------------------
 * Extends the hardened auth module with multi-tenant signup support.
 *
 * New functions vs. original:
 *   signUpAndCreateTenant()  — creates a new restaurant + user_profile in one call
 *   joinTenant()             — links an existing user to a tenant (invite flow)
 *   getMyTenantId()          — reads the current user's tenant from user_profiles
 */

import { supabase } from './supabase';
import { TENANT_SESSION_KEY } from './supabase';
import { securityLog } from './logger';
import type { User, Session } from '@supabase/supabase-js';


export type { User, Session };

// ─── Sign in with Google OAuth ────────────────────────────────────────────────
export async function signInWithGoogle() {
    if (typeof window === 'undefined') throw new Error('signInWithGoogle must be called client-side');

    const redirectTo = `${window.location.origin}/auth/callback`;
    securityLog.info('AUTH_GOOGLE_START', { origin: window.location.origin });

    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
            queryParams: {
                prompt: 'select_account',
                access_type: 'offline',
            },
        },
    });
    if (error) {
        securityLog.error('AUTH_LOGIN_FAILURE', { method: 'google', message: error.message });
        throw error;
    }
}

// ─── Sign in with Email + Password ───────────────────────────────────────────
export async function signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        securityLog.warn('AUTH_LOGIN_FAILURE', { method: 'email', email, message: error.message });
        throw error;
    }
    securityLog.info('AUTH_LOGIN_SUCCESS', { method: 'email', email, userId: data.user?.id });
    return data;
}

// ─── Sign up + Create new Tenant (Restaurant) ────────────────────────────────
/**
 * Creates a new auth user AND a new restaurant (tenant), then links them.
 * The tenant creation is done via a server-side API route (POST /api/tenant/create)
 * so it can use the service_role key to bypass RLS when inserting the restaurant
 * and user_profile rows.
 */
export async function signUpAndCreateTenant(
    email: string,
    password: string,
    fullName: string,
    restaurantName: string,
    masterPin: string
): Promise<{ userId: string; tenantId: string }> {
    // Step 1: Create the auth user
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
    });
    if (error) {
        securityLog.warn('AUTH_SIGNUP_FAILURE', { email, message: error.message });
        throw error;
    }
    if (!data.user) throw new Error('Signup succeeded but no user returned.');

    // Supabase returns a user with empty identities[] when email already exists
    // (to prevent email enumeration). Detect this case and show a helpful message.
    if (data.user.identities && data.user.identities.length === 0) {
        securityLog.warn('AUTH_SIGNUP_DUPLICATE', { email });
        throw new Error('User already registered. Please sign in instead, or use "Forgot Password" to reset your credentials.');
    }

    securityLog.info('AUTH_SIGNUP', { email, userId: data.user.id });

    // Step 2: Create the tenant + link user via server-side API
    const res = await fetch('/api/tenant/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: data.user.id,
            email,
            fullName,
            restaurantName,
            masterPin,
        }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create restaurant');

    securityLog.info('TENANT_CREATED', { userId: data.user.id, tenantId: result.tenantId });

    return { userId: data.user.id, tenantId: result.tenantId };
}

// ─── Sign up (original — for environments where tenant is pre-created) ────────
export async function signUpWithEmail(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
    });
    if (error) {
        securityLog.warn('AUTH_LOGIN_FAILURE', { method: 'signup', email, message: error.message });
        throw error;
    }
    securityLog.info('AUTH_SIGNUP', { email, userId: data.user?.id });
    return data;
}

// ─── Sign out (tenant only — does NOT touch admin session) ────────────────────
export async function signOut() {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    // Clear the tenant sessionStorage bucket explicitly (belt-and-suspenders)
    // IMPORTANT: we only remove TENANT_SESSION_KEY — the admin localStorage key
    // is untouched, so a logged-in super-admin in another tab is unaffected.
    if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(TENANT_SESSION_KEY);
    }
    if (error) {
        securityLog.error('AUTH_LOGOUT', { message: error.message });
        throw error;
    }
    securityLog.info('AUTH_LOGOUT', { scope: 'tenant' });
}

// ─── Clear stale session (for refresh token errors) ──────────────────────────
export function clearStaleSession() {
    if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(TENANT_SESSION_KEY);
        securityLog.warn('AUTH_STALE_SESSION_CLEARED', { key: TENANT_SESSION_KEY });
    }
}

// ─── Get current session (client-side) ───────────────────────────────────────
export async function getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

// ─── Admin check ─────────────────────────────────────────────────────────────
// Wrap checkIsAdmin in a pending promises map to prevent GoTrue from
// throwing 'AbortError: Lock broken by another request' during concurrent refreshes.
const pendingAdminChecks = new Map<string, Promise<boolean>>();

async function executeAdminCheck(email: string, retries: number): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('is_active')
            .eq('email', email)
            .eq('is_active', true)
            .maybeSingle();

        if (error) {
            if ((error.message?.includes('AbortError') || error.message?.includes('Lock broken')) && retries > 0) {
                await new Promise(r => setTimeout(r, 500));
                return executeAdminCheck(email, retries - 1);
            }
            securityLog.error('AUTHZ_ADMIN_CHECK', { email, message: error.message });
            return false;
        }

        const isAdmin = data !== null;
        securityLog.info('AUTHZ_ADMIN_CHECK', { email, result: isAdmin });
        return isAdmin;
    } catch (err: any) {
        if ((err.name === 'AbortError' || err.message?.includes('AbortError') || err.message?.includes('Lock broken')) && retries > 0) {
            await new Promise(r => setTimeout(r, 500));
            return executeAdminCheck(email, retries - 1);
        }
        securityLog.error('AUTHZ_ADMIN_CHECK', { email, message: err.message });
        return false;
    }
}

export async function checkIsAdmin(user: User, retries = 2): Promise<boolean> {
    const email = user.email;
    if (!email) {
        securityLog.warn('AUTHZ_DENIED', { reason: 'no_email', userId: user.id });
        return false;
    }

    if (pendingAdminChecks.has(email)) {
        return pendingAdminChecks.get(email)!;
    }

    const checkPromise = executeAdminCheck(email, retries).finally(() => {
        pendingAdminChecks.delete(email);
    });

    pendingAdminChecks.set(email, checkPromise);
    return checkPromise;
}

// ─── Update last_login timestamp ─────────────────────────────────────────────
export async function updateLastLogin(email: string) {
    await supabase
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('email', email);
}
