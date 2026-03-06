import { supabase } from './supabase';
import type { Order, MenuItem, Category, DashboardOrder } from './types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── ORDERS ─────────────────────────────────────────────────────────────────
// NOTE: orders uses `restaurant_id` as its tenant discriminator (existing schema).
// All authenticated queries are automatically scoped by the RLS policy which
// calls get_my_tenant_id(); explicit .eq() is a defence-in-depth measure.

/** Fetch all active orders (new/preparing/done) for the current tenant */
export async function fetchActiveOrders(tenantId: string): Promise<DashboardOrder[]> {
    const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items (*)`)
        .eq('restaurant_id', tenantId)
        .in('status', ['new', 'preparing', 'done'])
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapOrder);
}

/** Fetch order history (paid/cancelled) for the current tenant */
export async function fetchOrderHistory(tenantId: string, limit = 50): Promise<DashboardOrder[]> {
    const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items (*)`)
        .eq('restaurant_id', tenantId)
        .in('status', ['paid', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data || []).map(mapOrder);
}

/** Update order status */
export async function updateOrderStatus(
    orderId: string,
    status: Order['status']
): Promise<void> {
    const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);
    if (error) throw error;
}

/** Delete an order */
export async function deleteOrder(orderId: string): Promise<void> {
    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
    if (error) throw error;
}

/** Subscribe to real-time order changes for a specific tenant */
export function subscribeToOrders(
    tenantId: string,
    onChange: (orders: DashboardOrder[]) => void
): RealtimeChannel {
    const channelId = `orders-rt-${tenantId}-${Math.random().toString(36).substring(7)}`;
    const channel = supabase
        .channel(channelId)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: `restaurant_id=eq.${tenantId}`,
            },
            async () => {
                try {
                    const orders = await fetchActiveOrders(tenantId);
                    onChange(orders);
                } catch (err) {
                    console.error('Real-time fetch error:', err);
                }
            }
        )
        .subscribe();
    return channel;
}

/** Cleanly remove order subscription channel */
export async function unsubscribeFromOrders(channel: RealtimeChannel) {
    if (channel) {
        await supabase.removeChannel(channel);
    }
}

// ─── MENU ITEMS ─────────────────────────────────────────────────────────────

/** Fetch all menu items for the current tenant */
export async function fetchMenuItems(tenantId: string): Promise<MenuItem[]> {
    const { data, error } = await supabase
        .from('menu_items')
        .select(`*, categories (id, name)`)
        .eq('tenant_id', tenantId)
        .order('name');

    if (error) throw error;
    return data || [];
}

/** Toggle menu item availability */
export async function toggleMenuItemAvailability(
    itemId: string,
    available: boolean
): Promise<void> {
    const { error } = await supabase
        .from('menu_items')
        .update({ available })
        .eq('id', itemId);
    if (error) throw error;
}

/** Delete a menu item */
export async function deleteMenuItem(itemId: string): Promise<void> {
    const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', itemId);
    if (error) throw error;
}

/** Create a menu item for the current tenant */
export async function createMenuItem(
    tenantId: string,
    item: {
        name: string;
        price: number;
        category_id: string;
        type: 'veg' | 'non-veg';
        image_url?: string;
    }
): Promise<MenuItem> {
    const { data, error } = await supabase
        .from('menu_items')
        .insert([{ ...item, tenant_id: tenantId, available: true }])
        .select(`*, categories (id, name)`)
        .single();

    if (error) throw error;
    return data;
}

/** Update a menu item */
export async function updateMenuItem(
    itemId: string,
    updates: Partial<{ name: string; price: number; category_id: string; type: 'veg' | 'non-veg'; image_url: string }>
): Promise<void> {
    const { error } = await supabase
        .from('menu_items')
        .update(updates)
        .eq('id', itemId);
    if (error) throw error;
}

// ─── CATEGORIES ─────────────────────────────────────────────────────────────

/** Fetch all categories for the current tenant */
export async function fetchCategories(tenantId: string): Promise<Category[]> {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('display_order');

    if (error) throw error;
    return data || [];
}

/** Create a new category for the current tenant */
export async function createCategory(
    tenantId: string,
    name: string,
    displayOrder: number = 0
): Promise<Category> {
    const { data, error } = await supabase
        .from('categories')
        .insert([{ tenant_id: tenantId, name, display_order: displayOrder }])
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

/** Update a category */
export async function updateCategory(id: string, name: string): Promise<void> {
    const { error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', id);

    if (error) throw error;
}

/** Delete a category */
export async function deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// ─── SETTINGS ───────────────────────────────────────────────────────────────

/**
 * Check if the website is currently "Public" or "Admin-Only" for a given tenant.
 */
export async function fetchIsSitePublic(tenantId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'is_site_public')
        .eq('tenant_id', tenantId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching site status:', error.message);
        return true; // default to public on error
    }
    if (!data) return true;

    return data.value === true;
}

/**
 * Toggle the Site's Public Visibility for the current tenant.
 */
export async function updateSitePublic(tenantId: string, isPublic: boolean): Promise<void> {
    const { error } = await supabase
        .from('site_settings')
        .update({ value: isPublic })
        .eq('key', 'is_site_public')
        .eq('tenant_id', tenantId);

    if (error) {
        console.error('Error updating site status:', error.message);
        throw error;
    }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function mapOrder(raw: any): DashboardOrder {
    const items = (raw.order_items || []).map((oi: any) => ({
        id: oi.id,
        name: oi.item_name,
        quantity: oi.quantity,
        price: oi.item_price,
    }));

    return {
        id: raw.id,
        daily_order_number: raw.daily_order_number,
        table: raw.table_number,
        items,
        status: raw.status,
        total: raw.total,
        time: formatTimeAgo(raw.created_at),
        created_at: raw.created_at,
    };
}

function formatTimeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
}
