'use client';

/**
 * context/AuthContext.tsx  (multi-tenant)
 * ----------------------------------------
 * Extends the original hardened AuthContext with tenant (restaurant) awareness.
 *
 * After sign-in the context resolves three things in parallel:
 *   1. isAdmin  — via admin_users table (backwards compatible)
 *   2. tenantId — via user_profiles table (which restaurant this user manages)
 *   3. tenantName — display name for the restaurant
 *
 * All downstream data fetches use `tenantId` to scope their queries.
 */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { checkIsAdmin, updateLastLogin, signOut as authSignOut, clearStaleSession } from '@/lib/auth';
import { securityLog } from '@/lib/logger';
import type { User, Session } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
    session: Session | null;
    user: User | null;
    isAdmin: boolean;
    userRole: string | null;
    tenantId: string | null;
    tenantName: string | null;
    subscriptionTier: 'starter' | 'pro' | '1k' | '2k' | '2.5k' | null;
    subscriptionStatus: 'active' | 'past_due' | 'cancelled' | 'trial' | null;
    loading: boolean;
    tenantLoading: boolean;
    error: string | null;
}

interface AuthContextValue extends AuthState {
    signOut: () => Promise<void>;
    clearError: () => void;
    refreshTenant: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchUserProfile(userId: string, accessToken: string): Promise<{ tenant_id: string; tenant_name: string; role: string; subscription_tier: 'starter' | 'pro'; subscription_status: 'active' | 'past_due' | 'cancelled' | 'trial' } | null> {
    try {
        const res = await fetch('/api/auth/profile', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            securityLog.error('TENANT_FETCH', { userId, message: body.error || `HTTP ${res.status}` });
            return null;
        }

        const { profile } = await res.json();
        if (!profile) return null;

        return { 
            tenant_id: profile.tenant_id, 
            tenant_name: profile.tenant_name, 
            role: profile.role,
            subscription_tier: profile.subscription_tier || 'starter',
            subscription_status: profile.subscription_status || 'active',
        };
    } catch (err: any) {
        if (err.name === 'AbortError' || err.message?.includes('Lock broken')) {
            console.warn('[AuthContext] Lock contention caught, retrying...');
            await new Promise(r => setTimeout(r, 200));
            return fetchUserProfile(userId, accessToken);
        }
        securityLog.error('TENANT_FETCH', { userId, message: err.message });
        return null;
    }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        session: null,
        user: null,
        isAdmin: false,
        userRole: null,
        tenantId: null,
        tenantName: null,
        subscriptionTier: null,
        subscriptionStatus: null,
        loading: true,
        tenantLoading: false,
        error: null,
    });

    const hasInitialized = useRef(false);
    const pendingAuthRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasTenantRef = useRef(false);

    // Refresh tenant info on demand (e.g. after signup completes)
    const refreshTenant = async () => {
        const userId = state.user?.id;
        const token = state.session?.access_token;
        if (!userId || !token) return;
        setState(prev => ({ ...prev, tenantLoading: true }));
        const profile = await fetchUserProfile(userId, token);
        setState(prev => ({
            ...prev,
            userRole: profile?.role ?? prev.userRole,
            tenantId: profile?.tenant_id ?? null,
            tenantName: profile?.tenant_name ?? null,
            subscriptionTier: profile?.subscription_tier ?? prev.subscriptionTier,
            subscriptionStatus: profile?.subscription_status ?? prev.subscriptionStatus,
            tenantLoading: false,
        }));
    };

    useEffect(() => {
        let isActive = true;

        // Safety release: if auth hangs, unblock after 2.5s
        const safetyTimer = setTimeout(() => {
            if (isActive && !hasInitialized.current) {
                console.warn('[AuthContext] Progressive safety release.');
                setState(prev => ({ ...prev, loading: false }));
                hasInitialized.current = true;
            }
        }, 2500);

        // Safety release for tenantLoading - if it hangs for 5s, release it
        const tenantSafetyTimer = setTimeout(() => {
            if (isActive) {
                setState(prev => {
                    if (prev.tenantLoading) {
                        console.warn('[AuthContext] Tenant loading safety release.');
                        return { ...prev, tenantLoading: false };
                    }
                    return prev;
                });
            }
        }, 5000);

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`[AuthContext] event: ${event}`);

            // Handle token refresh failures - clear stale session data
            if (event === 'TOKEN_REFRESHED' && !session) {
                console.warn('[AuthContext] Token refresh failed - clearing stale session');
                clearStaleSession();
            }

            if (!session?.user) {
                if (isActive) {
                    hasTenantRef.current = false; // Reset tenant tracking
                    setState({
                        session: null,
                        user: null,
                        isAdmin: false,
                        userRole: null,
                        tenantId: null,
                        tenantName: null,
                        subscriptionTier: null,
                        subscriptionStatus: null,
                        loading: false,
                        tenantLoading: false,
                        error: null,
                    });
                    hasInitialized.current = true;
                    clearTimeout(safetyTimer);
                }
                return;
            }

            // Progressive load — set session immediately so UI can render
            if (isActive) {
                setState(prev => ({
                    ...prev,
                    session,
                    user: session.user,
                    loading: false,
                    // Only set tenantLoading if we don't already have tenant data
                    tenantLoading: hasTenantRef.current ? false : true,
                    error: null,
                }));
                hasInitialized.current = true;
                clearTimeout(safetyTimer);
            }

            // Skip re-fetching tenant if we already have it and this is just a session refresh
            if (hasTenantRef.current && event !== 'SIGNED_IN') {
                console.log('[AuthContext] Skipping profile re-fetch - tenant data exists');
                setState(prev => ({ ...prev, tenantLoading: false }));
                return;
            }

            // Debounce: cancel any pending auth resolution to avoid lock contention
            if (pendingAuthRef.current) {
                clearTimeout(pendingAuthRef.current);
            }

            // Small delay to coalesce rapid auth events (INITIAL_SESSION + TOKEN_REFRESHED)
            await new Promise<void>(resolve => {
                pendingAuthRef.current = setTimeout(resolve, 100);
            });

            if (!isActive) return;

            // Resolve admin + tenant in parallel
            try {
                const [isAdmin, profile] = await Promise.all([
                    checkIsAdmin(session.user).catch(() => false),
                    fetchUserProfile(session.user.id, session.access_token),
                ]);

                if (isActive) {
                    // Mark that we have tenant data to skip redundant fetches
                    if (profile?.tenant_id) {
                        hasTenantRef.current = true;
                    }
                    
                    setState(prev => ({
                        ...prev,
                        isAdmin,
                        userRole: profile?.role ?? null,
                        tenantId: profile?.tenant_id ?? null,
                        tenantName: profile?.tenant_name ?? null,
                        subscriptionTier: profile?.subscription_tier ?? null,
                        subscriptionStatus: profile?.subscription_status ?? null,
                        tenantLoading: false,
                    }));

                    if (event === 'SIGNED_IN' && isAdmin) {
                        await updateLastLogin(session.user.email!).catch(() => {});
                    }

                    securityLog.info('AUTH_TENANT_RESOLVED', {
                        userId: session.user.id,
                        tenantId: profile?.tenant_id,
                        isAdmin,
                    });
                }
            } catch (err: any) {
                console.error('[AuthContext] Background check error:', err);
                if (isActive) {
                    setState(prev => ({ ...prev, tenantLoading: false }));
                }
            }
        });

        return () => {
            isActive = false;
            subscription.unsubscribe();
            clearTimeout(safetyTimer);
            clearTimeout(tenantSafetyTimer);
            if (pendingAuthRef.current) clearTimeout(pendingAuthRef.current);
        };
    }, []);

    const signOut = async () => {
        hasTenantRef.current = false; // Reset tenant tracking
        setState({
            session: null, user: null, isAdmin: false, userRole: null,
            tenantId: null, tenantName: null, subscriptionTier: null, subscriptionStatus: null,
            loading: false, tenantLoading: false, error: null,
        });
        await authSignOut();
    };

    const clearError = () => setState(s => ({ ...s, error: null }));

    return (
        <AuthContext.Provider value={{ ...state, signOut, clearError, refreshTenant }}>
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
    return ctx;
}
