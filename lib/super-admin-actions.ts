'use server';

/**
 * Server Actions for Super Admin Dashboard
 * Uses Service Role Key to bypass RLS
 */

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client - bypasses RLS
function getServiceClient() {
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
    });
}

// Types
export interface PlatformStats {
    total_restaurants: number;
    total_revenue: number;
    active_orders: number;
    new_signups_30d: number;
}

export interface RestaurantWithOwner {
    id: string;
    name: string;
    owner_name: string | null;
    subscription_tier: 'starter' | 'pro' | '1k' | '2k' | '2.5k';
    subscription_status: 'active' | 'past_due' | 'cancelled' | 'trial';
    created_at: string;
    monthly_revenue: number;
    last_report_date: string | null;
    subscription_start_date: string | null;
    subscription_end_date: string | null;
    team_count: number;
    team_roles?: { role: string; count: number }[];
}

export interface GlobalLog {
    id: string;
    event_type: string;
    severity: 'info' | 'warning' | 'error' | 'success';
    message: string;
    metadata: Record<string, any>;
    tenant_id: string | null;
    user_id: string | null;
    created_at: string;
    restaurants?: { name: string } | null;
}

// ─── Verify Super Admin ──────────────────────────────────────────────────────

export async function verifySuperAdmin(userId: string): Promise<boolean> {
    const sb = getServiceClient();
    
    const { data, error } = await sb
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();
    
    if (error || !data) return false;
    return data.role === 'super_admin';
}

// ─── Get Platform Stats ──────────────────────────────────────────────────────

export async function getPlatformStats(): Promise<PlatformStats> {
    const sb = getServiceClient();
    
    // Get total restaurants
    const { count: totalRestaurants } = await sb
        .from('restaurants')
        .select('*', { count: 'exact', head: true });
    
    // Calculate MRR from subscription tiers
    const { data: restaurants } = await sb
        .from('restaurants')
        .select('subscription_tier, subscription_status');
    
    const totalRevenue = (restaurants || []).reduce((sum, r) => {
        if (r.subscription_status !== 'active') return sum;
        const tierPricing: Record<string, number> = { 'starter': 1000, 'pro': 2000, '1k': 1000, '2k': 2000, '2.5k': 2500 };
        const tierValue = tierPricing[r.subscription_tier] || 0;
        return sum + tierValue;
    }, 0);
    
    // Get active orders
    const { count: activeOrders } = await sb
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['new', 'preparing']);
    
    // Get new signups in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: newSignups } = await sb
        .from('restaurants')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());
    
    return {
        total_restaurants: totalRestaurants || 0,
        total_revenue: totalRevenue,
        active_orders: activeOrders || 0,
        new_signups_30d: newSignups || 0,
    };
}

// ─── Get All Restaurants ─────────────────────────────────────────────────────

export async function getAllRestaurants(
    page: number = 1,
    limit: number = 10,
    search: string = ''
): Promise<{ data: RestaurantWithOwner[]; total: number }> {
    const sb = getServiceClient();
    const offset = (page - 1) * limit;
    
    // First get restaurants
    let query = sb
        .from('restaurants')
        .select('id, name, subscription_tier, subscription_status, created_at, monthly_revenue, last_report_date, subscription_start_date, subscription_end_date', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    
    if (search) {
        query = query.ilike('name', `%${search}%`);
    }
    
    const { data: restaurants, count, error } = await query;
    
    if (error) {
        console.error('Error fetching restaurants:', error);
        return { data: [], total: 0 };
    }
    
    if (!restaurants || restaurants.length === 0) {
        return { data: [], total: count || 0 };
    }
    
    // Get all team members from user_profiles for each restaurant
    const restaurantIds = restaurants.map(r => r.id);
    const { data: allMembers } = await sb
        .from('user_profiles')
        .select('tenant_id, full_name, role')
        .in('tenant_id', restaurantIds);
    
    // Create maps for owner_name, team_count, and team_roles
    const ownerMap = new Map<string, string>();
    const teamCountMap = new Map<string, number>();
    const teamRolesMap = new Map<string, { role: string; count: number }[]>();
    
    (allMembers || []).forEach(m => {
        if (!m.tenant_id) return;
        
        // Set owner name
        if (m.role === 'owner' && m.full_name) {
            ownerMap.set(m.tenant_id, m.full_name);
        }
        
        // Increment team count
        teamCountMap.set(m.tenant_id, (teamCountMap.get(m.tenant_id) || 0) + 1);
        
        // Track roles
        const roles = teamRolesMap.get(m.tenant_id) || [];
        const existing = roles.find(r => r.role === m.role);
        if (existing) {
            existing.count++;
        } else {
            roles.push({ role: m.role, count: 1 });
        }
        teamRolesMap.set(m.tenant_id, roles);
    });
    
    // Combine data
    const data: RestaurantWithOwner[] = restaurants.map(r => ({
        ...r,
        owner_name: ownerMap.get(r.id) || null,
        team_count: teamCountMap.get(r.id) || 0,
        team_roles: teamRolesMap.get(r.id) || [],
    }));
    
    return { data, total: count || 0 };
}

// ─── Update Restaurant Subscription ──────────────────────────────────────────

export async function updateRestaurantSubscription(
    restaurantId: string,
    tier: 'starter' | 'pro' | '1k' | '2k'
): Promise<{ success: boolean; error?: string }> {
    const sb = getServiceClient();
    
    // Map old tier names to new DB values
    const dbTier = tier === '1k' ? 'starter' : tier === '2k' ? 'pro' : tier;
    
    const { error } = await sb
        .from('restaurants')
        .update({ subscription_tier: dbTier })
        .eq('id', restaurantId);
    
    if (error) {
        return { success: false, error: error.message };
    }
    
    // Log the activity
    await logActivity(
        'SUBSCRIPTION_CHANGE',
        `Subscription changed to ${tier} tier`,
        'info',
        { restaurant_id: restaurantId, new_tier: tier },
        restaurantId
    );
    
    revalidatePath('/super-admin');
    return { success: true };
}

// ─── Update Restaurant Status ────────────────────────────────────────────────

export async function updateRestaurantStatus(
    restaurantId: string,
    status: 'active' | 'past_due' | 'cancelled' | 'trial'
): Promise<{ success: boolean; error?: string }> {
    const sb = getServiceClient();
    
    const { error } = await sb
        .from('restaurants')
        .update({ subscription_status: status })
        .eq('id', restaurantId);
    
    if (error) {
        return { success: false, error: error.message };
    }
    
    // Log the activity
    await logActivity(
        'STATUS_CHANGE',
        `Restaurant status changed to ${status}`,
        status === 'cancelled' ? 'warning' : 'info',
        { restaurant_id: restaurantId, new_status: status },
        restaurantId
    );
    
    revalidatePath('/super-admin');
    return { success: true };
}

// ─── Update Subscription Dates ───────────────────────────────────────────────

export async function updateSubscriptionDates(
    restaurantId: string,
    startDate: string | null,
    endDate: string | null
): Promise<{ success: boolean; error?: string }> {
    const sb = getServiceClient();
    
    const updateData: Record<string, any> = {};
    
    // Handle start date
    if (startDate !== undefined) {
        updateData.subscription_start_date = startDate || null;
    }
    
    // Handle end date
    if (endDate !== undefined) {
        updateData.subscription_end_date = endDate || null;
    }
    
    // Also update status based on dates
    const today = new Date().toISOString().split('T')[0];
    
    if (endDate && endDate < today) {
        // End date is in the past - mark as cancelled
        updateData.subscription_status = 'cancelled';
    } else if (startDate && startDate > today) {
        // Start date is in the future - mark as trial
        updateData.subscription_status = 'trial';
    } else if (startDate && startDate <= today && (!endDate || endDate >= today)) {
        // Active subscription
        updateData.subscription_status = 'active';
    }
    
    const { error } = await sb
        .from('restaurants')
        .update(updateData)
        .eq('id', restaurantId);
    
    if (error) {
        return { success: false, error: error.message };
    }
    
    // Log the activity
    await logActivity(
        'SUBSCRIPTION_DATES_CHANGED',
        `Subscription dates updated: ${startDate || 'none'} to ${endDate || 'none'}`,
        'info',
        { restaurant_id: restaurantId, start_date: startDate, end_date: endDate },
        restaurantId
    );
    
    revalidatePath('/super-admin');
    return { success: true };
}

// ─── Delete Restaurant ───────────────────────────────────────────────────────

export async function deleteRestaurant(
    restaurantId: string
): Promise<{ success: boolean; error?: string }> {
    const sb = getServiceClient();
    
    // Get restaurant info first for logging
    const { data: restaurant } = await sb
        .from('restaurants')
        .select('name, owner_email')
        .eq('id', restaurantId)
        .single();
    
    // Delete all related data (cascade should handle most, but be explicit)
    // Delete order_items first (through orders)
    const { data: orders } = await sb
        .from('orders')
        .select('id')
        .eq('restaurant_id', restaurantId);
    
    if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        await sb.from('order_items').delete().in('order_id', orderIds);
        await sb.from('orders').delete().eq('restaurant_id', restaurantId);
    }
    
    // Delete menu items and categories
    await sb.from('menu_items').delete().eq('tenant_id', restaurantId);
    await sb.from('categories').delete().eq('tenant_id', restaurantId);
    
    // Delete user profiles for this tenant
    await sb.from('user_profiles').delete().eq('tenant_id', restaurantId);
    
    // Delete site settings for this tenant
    await sb.from('site_settings').delete().eq('tenant_id', restaurantId);
    
    // Delete daily reports for this restaurant
    await sb.from('daily_reports').delete().eq('restaurant_id', restaurantId);
    
    // Finally delete the restaurant
    const { error } = await sb
        .from('restaurants')
        .delete()
        .eq('id', restaurantId);
    
    if (error) {
        return { success: false, error: error.message };
    }
    
    // Log the activity
    await logActivity(
        'RESTAURANT_DELETED',
        `Restaurant "${restaurant?.name}" deleted`,
        'warning',
        { restaurant_id: restaurantId, restaurant_name: restaurant?.name, owner_email: restaurant?.owner_email }
    );
    
    revalidatePath('/super-admin');
    return { success: true };
}

// ─── Reset User Password ─────────────────────────────────────────────────────

export async function resetUserPassword(
    userId: string,
    newPassword?: string
): Promise<{ success: boolean; tempPassword?: string; error?: string }> {
    const sb = getServiceClient();
    
    // Get user email for logging
    const { data: { user } } = await sb.auth.admin.getUserById(userId);
    
    if (!user) {
        return { success: false, error: 'User not found' };
    }
    
    if (newPassword) {
        // Set specific password
        const { error } = await sb.auth.admin.updateUserById(userId, {
            password: newPassword,
        });
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        await logActivity(
            'PASSWORD_RESET',
            `Password manually reset for ${user.email}`,
            'info',
            { user_id: userId, email: user.email }
        );
        
        return { success: true };
    } else {
        // Generate temp password
        const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
        
        const { error } = await sb.auth.admin.updateUserById(userId, {
            password: tempPassword,
        });
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        await logActivity(
            'PASSWORD_RESET',
            `Temporary password generated for ${user.email}`,
            'info',
            { user_id: userId, email: user.email }
        );
        
        return { success: true, tempPassword };
    }
}

// ─── Send Password Reset Email ───────────────────────────────────────────────

export async function sendPasswordResetEmail(
    email: string
): Promise<{ success: boolean; error?: string }> {
    const sb = getServiceClient();
    
    const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?type=recovery`,
    });
    
    if (error) {
        return { success: false, error: error.message };
    }
    
    await logActivity(
        'PASSWORD_RESET_EMAIL',
        `Password reset email sent to ${email}`,
        'info',
        { email }
    );
    
    return { success: true };
}

// ─── Get User for Impersonation ──────────────────────────────────────────────

export async function getImpersonationToken(
    userId: string
): Promise<{ success: boolean; token?: string; error?: string }> {
    const sb = getServiceClient();
    
    // Generate a magic link for the user
    const { data: { user } } = await sb.auth.admin.getUserById(userId);
    
    if (!user?.email) {
        return { success: false, error: 'User not found' };
    }
    
    // Create a magic link that logs them in
    const { data, error } = await sb.auth.admin.generateLink({
        type: 'magiclink',
        email: user.email,
        options: {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard`,
        }
    });
    
    if (error) {
        return { success: false, error: error.message };
    }
    
    await logActivity(
        'IMPERSONATION',
        `Super admin impersonating ${user.email}`,
        'warning',
        { user_id: userId, email: user.email }
    );
    
    // Return the magic link action_link
    return { success: true, token: data.properties?.action_link };
}

// ─── Get Global Logs ─────────────────────────────────────────────────────────

export async function getGlobalLogs(
    limit: number = 50,
    offset: number = 0,
    eventType?: string
): Promise<GlobalLog[]> {
    const sb = getServiceClient();
    
    let query = sb
        .from('global_logs')
        .select('*, restaurants(name)')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    
    if (eventType) {
        query = query.eq('event_type', eventType);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error fetching logs:', error);
        return [];
    }
    
    return data || [];
}

// ─── Log Activity ────────────────────────────────────────────────────────────

export async function logActivity(
    eventType: string,
    message: string,
    severity: 'info' | 'warning' | 'error' | 'success' = 'info',
    metadata: Record<string, any> = {},
    tenantId?: string,
    userId?: string
): Promise<void> {
    const sb = getServiceClient();
    
    await sb
        .from('global_logs')
        .insert({
            event_type: eventType,
            message,
            severity,
            metadata,
            tenant_id: tenantId || null,
            user_id: userId || null,
        });
}

// ─── Get Restaurant Users ────────────────────────────────────────────────────

export async function getRestaurantUsers(
    restaurantId: string
): Promise<{ id: string; email: string; role: string; full_name: string | null }[]> {
    const sb = getServiceClient();
    
    const { data: profiles, error } = await sb
        .from('user_profiles')
        .select('id, role, full_name')
        .eq('tenant_id', restaurantId);
    
    if (error || !profiles) {
        return [];
    }
    
    // Get user emails from auth
    const users = await Promise.all(
        profiles.map(async (p) => {
            const { data: { user } } = await sb.auth.admin.getUserById(p.id);
            return {
                id: p.id,
                email: user?.email || 'Unknown',
                role: p.role,
                full_name: p.full_name,
            };
        })
    );
    
    return users;
}

// ─── Create Super Admin ───────────────────────────────────────────────────────

export async function promoteToSuperAdmin(
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const sb = getServiceClient();
    
    const { error } = await sb
        .from('user_profiles')
        .update({ role: 'super_admin' })
        .eq('id', userId);
    
    if (error) {
        return { success: false, error: error.message };
    }
    
    const { data: { user } } = await sb.auth.admin.getUserById(userId);
    
    await logActivity(
        'SUPER_ADMIN_PROMOTED',
        `${user?.email} promoted to super admin`,
        'success',
        { user_id: userId, email: user?.email }
    );
    
    return { success: true };
}
