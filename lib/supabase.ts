/**
 * lib/supabase.ts  (hardened + isolated sessions)
 * -------------------------------------------------
 * Two completely independent Supabase clients with different storage keys
 * so the Super-Admin session and the Tenant session can NEVER overwrite
 * each other in the browser.
 *
 * Storage layout
 * ──────────────
 *  Client               Storage         Key
 *  ────────────────────────────────────────────────────────────
 *  supabase (tenant)    sessionStorage  hotelpro-tenant-session
 *  supabaseSuperAdmin   localStorage    hotelpro-admin-session
 *  supabaseCustomer     (none)          __none__
 *  supabaseAdmin        (server only)   n/a
 *
 * Why sessionStorage for tenants?
 *   Each browser TAB gets its own isolated session.  This is the core
 *   mechanism that prevents cross-tab contamination: logging into
 *   Restaurant B in Tab 2 does NOT affect Restaurant A in Tab 1.
 *
 * Why localStorage for Super-Admin?
 *   The super-admin session must survive page refreshes and persist
 *   across tabs (the admin might have many tabs open).
 *   It lives under a DIFFERENT key so tenant sign-in never touches it.
 *
 * Sign-out isolation
 * ──────────────────
 *   Calling supabase.auth.signOut()       → clears hotelpro-tenant-session only
 *   Calling supabaseSuperAdmin.signOut()  → clears hotelpro-admin-session only
 *   The two are 100% independent.
 */

import { createClient } from '@supabase/supabase-js';
import { validateEnv, env } from './env';

// Fail-fast on missing env vars
validateEnv();

/** Storage key constants — single source of truth */
export const TENANT_SESSION_KEY = 'hotelpro-tenant-session';
export const ADMIN_SESSION_KEY = 'hotelpro-admin-session';

/**
 * Custom fetcher that routes Supabase requests through our local proxy.
 * Circumvents "Failed to fetch" errors from security software (e.g. Kaspersky)
 * that blocks direct connections to supabase.co.
 * Includes enterprise-grade retry logic (3 attempts, exponential back-off).
 */
const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let urlStr: string;
    let requestInit: RequestInit = init || {};

    if (input instanceof Request) {
        urlStr = input.url;
        const headers = new Headers(requestInit.headers || {});
        input.headers.forEach((v, k) => {
            if (!headers.has(k)) headers.set(k, v);
        });
        requestInit = {
            ...requestInit,
            method: input.method || requestInit.method,
            headers,
        };
    } else {
        urlStr = input.toString();
    }

    // Server-side: use native fetch directly
    if (typeof window === 'undefined') return fetch(input, requestInit);

    try {
        const u = new URL(urlStr);
        const supabaseHost = new URL(env.supabaseUrl).hostname;

        if (u.hostname === supabaseHost || u.hostname.endsWith('supabase.co')) {
            const proxyUrl = new URL('/api/auth/proxy', window.location.origin);
            let path = u.pathname;
            if (path.startsWith('/')) path = path.slice(1);
            proxyUrl.searchParams.set('path', path);
            u.searchParams.forEach((v, k) => proxyUrl.searchParams.set(k, v));

            let attempt = 0;
            const maxAttempts = 3;

            const doFetch = async (): Promise<Response> => {
                attempt++;
                try {
                    const res = await fetch(proxyUrl.toString(), requestInit);
                    if (attempt < maxAttempts && (res.status === 502 || res.status === 504)) {
                        console.warn(`[customFetch] Retry ${attempt}/${maxAttempts} (${res.status}): ${path}`);
                        await new Promise(r => setTimeout(r, 500 * attempt));
                        return doFetch();
                    }
                    return res;
                } catch (err) {
                    if (attempt < maxAttempts) {
                        console.warn(`[customFetch] Retry ${attempt}/${maxAttempts} (error): ${path}`);
                        await new Promise(r => setTimeout(r, 500 * attempt));
                        return doFetch();
                    }
                    throw err;
                }
            };

            return doFetch();
        }
    } catch {
        // relative URL or parse error — fall through to native fetch
    }

    return fetch(input, requestInit);
};

// ─── Tenant Dashboard Client ──────────────────────────────────────────────────
// Scope: all /[storeId]/dashboard/* pages.
// Storage: sessionStorage → tab-isolated → each tab has its own session.
// Key: hotelpro-tenant-session
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
        storageKey: TENANT_SESSION_KEY,
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
    },
    global: {
        fetch: customFetch,
        headers: { 'X-Client-Info': 'hotelpro-tenant/1.0' },
    },
});

// ─── Super-Admin Client ───────────────────────────────────────────────────────
// Scope: all /super-admin/* pages only.
// Storage: localStorage → persists across tabs and page refreshes.
// Key: hotelpro-admin-session  (different namespace from tenant client)
//
// CRITICAL: this client is seeded via setSession() in the login flow after
// confirming role === 'super_admin'. The super-admin layout exclusively uses
// SuperAdminAuthContext which watches THIS client — never the tenant client.
export const supabaseSuperAdmin = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
        storageKey: ADMIN_SESSION_KEY,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // admin never lands from OAuth redirect on /super-admin
        flowType: 'pkce',
    },
    global: {
        fetch: customFetch,
        headers: { 'X-Client-Info': 'hotelpro-admin/1.0' },
    },
});

// ─── Customer Client (fully anonymous) ───────────────────────────────────────
// Scope: /customer/* pages only. No session, purely anon-key access.
export const supabaseCustomer = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: '__none__',
    },
    global: {
        fetch: customFetch,
        headers: { 'X-Client-Info': 'hotelpro-customer/1.0' },
    },
});

// ─── Privileged Admin Client (server-side only) ───────────────────────────────
// Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS for administrative tasks.
// NEVER expose this on the client side.
export const supabaseAdmin = createClient(
    env.supabaseUrl,
    (typeof window === 'undefined'
        ? (process.env.SUPABASE_SERVICE_ROLE_KEY || env.supabaseAnonKey)
        : env.supabaseAnonKey),
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    }
);
