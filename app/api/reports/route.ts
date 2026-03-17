import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { generateDailyReport, isProTier } from '@/lib/reports';

/**
 * GET /api/reports  (Firebase)
 * Fetch daily reports for a restaurant
 * Query params: restaurantId, startDate, endDate, limit
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.replace('Bearer ', '');

    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurantId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '30');

    if (!restaurantId) {
        return NextResponse.json({ error: 'restaurantId required' }, { status: 400 });
    }

    // Verify user token
    let decodedToken;
    try {
        decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const userRecord = await adminAuth.getUser(uid);
    const claims = userRecord.customClaims || {};

    // Verify user belongs to this restaurant (or is super_admin)
    const claimRestaurantId = String(claims.restaurant_id || claims.tenant_id || '');
    if (claims.role !== 'super_admin' && claimRestaurantId !== restaurantId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check subscription tier
    const restDoc = await adminFirestore.doc(`restaurants/${restaurantId}`).get();
    const restData = restDoc.data();

    const isPro = isProTier(restData?.subscription_tier);

    if (!isPro) {
        return NextResponse.json({
            error: 'Reports are a Pro feature',
            upgrade: true
        }, { status: 403 });
    }

    // Fetch reports from analytics sub-collection
    try {
        let query = adminFirestore
            .collection(`restaurants/${restaurantId}/analytics`)
            .orderBy('report_date', 'desc')
            .limit(limit);

        if (startDate) {
            query = query.where('report_date', '>=', startDate);
        }
        if (endDate) {
            query = query.where('report_date', '<=', endDate);
        }

        const reportsSnap = await query.get();
        const reports = reportsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        return NextResponse.json({ reports });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/reports  (Firebase)
 * Generate a daily report for a specific date
 */
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.replace('Bearer ', '');

    const body = await request.json();
    const { restaurantId, date } = body;

    if (!restaurantId) {
        return NextResponse.json({ error: 'restaurantId required' }, { status: 400 });
    }

    // Verify user token
    let decodedToken;
    try {
        decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const userRecord = await adminAuth.getUser(uid);
    const claims = userRecord.customClaims || {};

    // Verify user belongs to this restaurant
    const claimRestaurantId = String(claims.restaurant_id || claims.tenant_id || '');
    if (claims.role !== 'super_admin' && claimRestaurantId !== restaurantId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check subscription tier
    const restDoc = await adminFirestore.doc(`restaurants/${restaurantId}`).get();
    const restData = restDoc.data();

    const isPro = isProTier(restData?.subscription_tier);

    if (!isPro) {
        return NextResponse.json({
            error: 'Reports are a Pro feature',
            upgrade: true
        }, { status: 403 });
    }

    const { report, restaurantName } = await generateDailyReport(restaurantId, date);

    return NextResponse.json({
        report,
        restaurantName,
    });
}
