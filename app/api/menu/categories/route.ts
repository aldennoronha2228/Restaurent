import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

function isManagerRole(role: unknown): boolean {
    const value = String(role || '').toLowerCase();
    return value === 'owner' || value === 'admin' || value === 'super_admin';
}

async function authorizeManageCategories(idToken: string, restaurantId: string): Promise<{ uid: string; role: string } | null> {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userRecord = await adminAuth.getUser(decoded.uid);
    const claims = userRecord.customClaims || {};

    const role = String(claims.role || '');
    if (role === 'super_admin') {
        return { uid: decoded.uid, role };
    }

    const claimRestaurantId = String(claims.restaurant_id || claims.tenant_id || '');
    if (claimRestaurantId === restaurantId && isManagerRole(role)) {
        return { uid: decoded.uid, role };
    }

    // Fallback to staff doc role check when claims are stale.
    const staffDoc = await adminFirestore.doc(`restaurants/${restaurantId}/staff/${decoded.uid}`).get();
    const staffRole = String(staffDoc.data()?.role || '');
    if (staffDoc.exists && isManagerRole(staffRole)) {
        return { uid: decoded.uid, role: staffRole };
    }

    return null;
}

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.slice(7);

    try {
        const body = await request.json();
        const restaurantId = String(body.restaurantId || '').trim();
        const name = String(body.name || '').trim();

        if (!restaurantId || !name) {
            return NextResponse.json({ error: 'restaurantId and name are required' }, { status: 400 });
        }

        const authz = await authorizeManageCategories(idToken, restaurantId);
        if (!authz) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const categoriesRef = adminFirestore.collection(`restaurants/${restaurantId}/categories`);
        const categoriesSnap = await categoriesRef.orderBy('display_order').get();

        const normalized = name.toLowerCase();
        const duplicate = categoriesSnap.docs.find((doc) => String(doc.data().name || '').trim().toLowerCase() === normalized);
        if (duplicate) {
            return NextResponse.json({
                category: {
                    id: duplicate.id,
                    ...duplicate.data(),
                },
            });
        }

        const maxDisplayOrder = categoriesSnap.docs.reduce((max, doc) => {
            const value = Number(doc.data().display_order || 0);
            return Number.isFinite(value) && value > max ? value : max;
        }, 0);

        const newCategoryRef = categoriesRef.doc();
        await newCategoryRef.set({
            name,
            display_order: maxDisplayOrder + 1,
            created_at: FieldValue.serverTimestamp(),
        });

        const created = await newCategoryRef.get();
        return NextResponse.json({
            category: {
                id: created.id,
                ...created.data(),
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to create category' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.slice(7);
    const { searchParams } = new URL(request.url);
    const restaurantId = String(searchParams.get('restaurantId') || '').trim();
    const categoryId = String(searchParams.get('categoryId') || '').trim();

    if (!restaurantId || !categoryId) {
        return NextResponse.json({ error: 'restaurantId and categoryId are required' }, { status: 400 });
    }

    try {
        const authz = await authorizeManageCategories(idToken, restaurantId);
        if (!authz) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const categoryRef = adminFirestore.doc(`restaurants/${restaurantId}/categories/${categoryId}`);
        const categoryDoc = await categoryRef.get();
        if (!categoryDoc.exists) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        const categoriesSnap = await adminFirestore
            .collection(`restaurants/${restaurantId}/categories`)
            .orderBy('display_order')
            .get();

        if (categoriesSnap.size <= 1) {
            return NextResponse.json({ error: 'At least one category is required' }, { status: 400 });
        }

        const fallbackCategory = categoriesSnap.docs.find((doc) => doc.id !== categoryId);
        if (!fallbackCategory) {
            return NextResponse.json({ error: 'No fallback category available' }, { status: 400 });
        }

        const menuItemsSnap = await adminFirestore
            .collection(`restaurants/${restaurantId}/menu_items`)
            .where('category_id', '==', categoryId)
            .get();

        if (!menuItemsSnap.empty) {
            const batch = adminFirestore.batch();
            for (const itemDoc of menuItemsSnap.docs) {
                batch.update(itemDoc.ref, {
                    category_id: fallbackCategory.id,
                    category_name: String(fallbackCategory.data().name || ''),
                    updated_at: FieldValue.serverTimestamp(),
                });
            }
            await batch.commit();
        }

        await categoryRef.delete();

        return NextResponse.json({
            success: true,
            movedItems: menuItemsSnap.size,
            fallbackCategoryId: fallbackCategory.id,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to delete category' }, { status: 500 });
    }
}
