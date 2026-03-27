import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
import { authorizeTenantAccess } from '@/lib/server/authz/tenant';

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

type OrderStatus = 'new' | 'preparing' | 'done' | 'paid' | 'cancelled';

function normalize(value: unknown): string {
    return String(value || '').trim().toLowerCase();
}

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.replace('Bearer ', '');
    const { searchParams } = new URL(request.url);
    const restaurantId = (searchParams.get('restaurantId') || '').trim();
    const query = (searchParams.get('q') || '').trim().toLowerCase();

    if (!restaurantId) {
        return NextResponse.json({ error: 'restaurantId required' }, { status: 400 });
    }

    if (!query) {
        return NextResponse.json({ orders: [], menuItems: [] });
    }

    try {
        const authz = await authorizeTenantAccess(idToken, restaurantId, 'read');
        if (!authz) {
            return NextResponse.json({
                error: `Forbidden: tenant mismatch. You are not allowed to search data for restaurantId=${restaurantId}.`,
            }, { status: 403 });
        }

        const [ordersSnap, menuSnap] = await Promise.all([
            adminFirestore
                .collection(`restaurants/${restaurantId}/orders`)
                .orderBy('created_at', 'desc')
                .limit(80)
                .get(),
            adminFirestore
                .collection(`restaurants/${restaurantId}/menu_items`)
                .orderBy('name', 'asc')
                .limit(120)
                .get(),
        ]);

        const orders = ordersSnap.docs
            .map((doc) => {
                const data = doc.data() as Record<string, unknown>;
                return {
                    id: doc.id,
                    daily_order_number: Number(data.daily_order_number || 0) || undefined,
                    table_number: String(data.table_number || ''),
                    status: String(data.status || 'new') as OrderStatus,
                };
            })
            .filter((order) => {
                return normalize(order.table_number).includes(query) || normalize(order.status).includes(query);
            })
            .slice(0, 5);

        const menuItems = menuSnap.docs
            .map((doc) => {
                const data = doc.data() as Record<string, unknown>;
                return {
                    id: doc.id,
                    name: String(data.name || ''),
                    price: Number(data.price || 0),
                    available: data.available !== false,
                };
            })
            .filter((item) => normalize(item.name).includes(query))
            .slice(0, 5);

        return NextResponse.json({ orders, menuItems });
    } catch (error: unknown) {
        return NextResponse.json({ error: errorMessage(error, 'Invalid session') }, { status: 401 });
    }
}
