export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

function normalizeYmd(value: unknown): string | null {
    const raw = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function getTodayYmdUtc(): string {
    return new Date().toISOString().slice(0, 10);
}

function daysUntilYmd(endDateYmd: string): number {
    const endDate = new Date(`${endDateYmd}T00:00:00Z`);
    const todayYmd = getTodayYmdUtc();
    const todayDate = new Date(`${todayYmd}T00:00:00Z`);
    return Math.round((endDate.getTime() - todayDate.getTime()) / 86400000);
}

function normalizeEmail(value: unknown): string {
    return String(value || '').trim().toLowerCase();
}

function getRestaurantIdFromStaffPath(path: string): string | null {
    const match = String(path || '').match(/^restaurants\/([^/]+)\/staff\/[^/]+$/);
    return match?.[1] || null;
}

async function findStaffMembership(uid: string, normalizedUserEmail: string) {
    const queries = [
        uid
            ? adminFirestore.collectionGroup('staff').where('uid', '==', uid).limit(1).get()
            : Promise.resolve(null),
        normalizedUserEmail
            ? adminFirestore.collectionGroup('staff').where('email', '==', normalizedUserEmail).limit(1).get()
            : Promise.resolve(null),
        normalizedUserEmail
            ? adminFirestore.collectionGroup('staff').where('email_lower', '==', normalizedUserEmail).limit(1).get()
            : Promise.resolve(null),
    ];

    const [byUid, byEmail, byEmailLower] = await Promise.all(queries);
    const firstDoc =
        (byUid && !byUid.empty ? byUid.docs[0] : null)
        || (byEmail && !byEmail.empty ? byEmail.docs[0] : null)
        || (byEmailLower && !byEmailLower.empty ? byEmailLower.docs[0] : null);

    if (!firstDoc) return null;

    const restaurantId = getRestaurantIdFromStaffPath(firstDoc.ref.path);
    if (!restaurantId) return null;

    return {
        restaurantId,
        staffData: firstDoc.data() as Record<string, unknown>,
    };
}

async function findOwnerRestaurant(normalizedUserEmail: string) {
    if (!normalizedUserEmail) return null;

    const [byOwnerEmail, byOwnerEmailLower] = await Promise.all([
        adminFirestore.collection('restaurants').where('owner_email', '==', normalizedUserEmail).limit(1).get(),
        adminFirestore.collection('restaurants').where('owner_email_lower', '==', normalizedUserEmail).limit(1).get(),
    ]);

    if (!byOwnerEmail.empty) {
        return byOwnerEmail.docs[0];
    }

    if (!byOwnerEmailLower.empty) {
        return byOwnerEmailLower.docs[0];
    }

    return null;
}

/**
 * GET /api/auth/profile
 * Fetches the current user's profile using Firebase Admin SDK.
 * Reads custom claims and Firestore restaurant data.
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const idToken = authHeader.replace('Bearer ', '');

    try {
        // Verify the Firebase ID token
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // Fetch current claims and record
        const userRecord = await adminAuth.getUser(uid);
        const claims = {
            ...(userRecord.customClaims || {}),
            role: (decodedToken.role as string) || (userRecord.customClaims?.role as string),
            restaurant_id: (decodedToken.restaurant_id as string) || (userRecord.customClaims?.restaurant_id as string),
            tenant_id: (decodedToken.tenant_id as string) || (userRecord.customClaims?.tenant_id as string),
            must_change_password: Boolean(decodedToken.must_change_password || userRecord.customClaims?.must_change_password),
            impersonated_by_super_admin: Boolean(
                decodedToken.impersonated_by_super_admin || userRecord.customClaims?.impersonated_by_super_admin
            ),
        };
        const normalizedUserEmail = normalizeEmail(userRecord.email);

        // ─── Environment-based Super Admin Sync ────────────────────────────────
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
        const userEmail = userRecord.email;
        const currentRole = claims.role as string;

        if (superAdminEmail && userEmail === superAdminEmail) {
            // New email from ENV should be super_admin
            if (currentRole !== 'super_admin') {
                await adminAuth.setCustomUserClaims(uid, { role: 'super_admin' });
            }
            return NextResponse.json({
                profile: {
                    tenant_id: null,
                    tenant_name: 'Platform Admin',
                    role: 'super_admin',
                    must_change_password: false,
                    full_name: userRecord.displayName || userRecord.email,
                    subscription_tier: 'pro',
                    subscription_status: 'active',
                },
            });
        }

        if (currentRole === 'super_admin' && userEmail !== superAdminEmail) {
            // Keep existing super-admin sessions non-destructive even when ENV is updated.
            // This prevents login loops and accidental account deletion.
            console.warn(`[AuthSync] Super admin email mismatch for ${userEmail}; preserving access`);
            return NextResponse.json({
                profile: {
                    tenant_id: null,
                    tenant_name: 'Platform Admin',
                    role: 'super_admin',
                    must_change_password: false,
                    full_name: userRecord.displayName || userRecord.email,
                    subscription_tier: 'pro',
                    subscription_status: 'active',
                },
            });
        }
        // ───────────────────────────────────────────────────────────────────────

        // Check if user has a restaurant_id claim
        const tenantId = (claims.restaurant_id || claims.tenant_id) as string;
        if (tenantId && claims.role) {
            // Get restaurant data
            const restDoc = await adminFirestore.doc(`restaurants/${tenantId}`).get();
            const restData = restDoc.data();

            const endDate = normalizeYmd(restData?.subscription_end_date);
            const todayYmd = getTodayYmdUtc();

            let effectiveStatus = (restData?.subscription_status || 'active') as string;
            if (endDate && endDate < todayYmd) {
                effectiveStatus = 'expired';
                await adminFirestore.doc(`restaurants/${tenantId}`).update({
                    subscription_status: 'expired',
                    account_temporarily_disabled: true,
                    account_disabled_reason: 'subscription_expired',
                    account_temporarily_disabled_at: new Date().toISOString(),
                }).catch(() => { });
            }

            const daysUntilEnd = endDate ? daysUntilYmd(endDate) : null;
            const showEndingSoonReminder =
                effectiveStatus !== 'cancelled' &&
                effectiveStatus !== 'past_due' &&
                typeof daysUntilEnd === 'number' &&
                daysUntilEnd >= 0 &&
                daysUntilEnd <= 5;

            // Also check staff sub-collection for the user's info
            const staffDoc = await adminFirestore
                .doc(`restaurants/${tenantId}/staff/${uid}`)
                .get();
            const staffData = staffDoc.data();

            return NextResponse.json({
                profile: {
                    tenant_id: tenantId,
                    tenant_name: restData?.name || tenantId,
                    role: claims.role,
                    must_change_password: Boolean(claims.must_change_password),
                    full_name: staffData?.full_name || userRecord.displayName || userRecord.email,
                    is_impersonating: Boolean(claims.impersonated_by_super_admin),
                    subscription_tier: restData?.subscription_tier || 'starter',
                    subscription_status: effectiveStatus,
                    subscription_end_date: endDate,
                    subscription_days_remaining: daysUntilEnd,
                    subscription_ending_soon: showEndingSoonReminder,
                },
            });
        }

        // No claims set — resolve tenant membership using indexed collectionGroup/owner lookups.
        const membership = await findStaffMembership(uid, normalizedUserEmail);
        const ownerRestaurantDoc = membership ? null : await findOwnerRestaurant(normalizedUserEmail);

        const resolvedRestaurantId = membership?.restaurantId || ownerRestaurantDoc?.id || null;
        const matchedStaffData = membership?.staffData
            || (ownerRestaurantDoc ? { role: 'owner', email: normalizedUserEmail } : null);

        if (resolvedRestaurantId && matchedStaffData) {
            const restDoc = await adminFirestore.doc(`restaurants/${resolvedRestaurantId}`).get();
            const restData = restDoc.data() || {};
            const resolvedRole = String(matchedStaffData.role || 'staff').trim() || 'staff';

            const endDate = normalizeYmd(restData?.subscription_end_date);
            const todayYmd = getTodayYmdUtc();

            let effectiveStatus = (restData?.subscription_status || 'active') as string;
            if (endDate && endDate < todayYmd) {
                effectiveStatus = 'expired';
                await adminFirestore.doc(`restaurants/${resolvedRestaurantId}`).update({
                    subscription_status: 'expired',
                    account_temporarily_disabled: true,
                    account_disabled_reason: 'subscription_expired',
                    account_temporarily_disabled_at: new Date().toISOString(),
                }).catch(() => { });
            }

            const daysUntilEnd = endDate ? daysUntilYmd(endDate) : null;
            const showEndingSoonReminder =
                effectiveStatus !== 'cancelled' &&
                effectiveStatus !== 'past_due' &&
                typeof daysUntilEnd === 'number' &&
                daysUntilEnd >= 0 &&
                daysUntilEnd <= 5;

            // Set custom claims for faster future lookups (non-blocking for profile response).
            const nextClaims: Record<string, unknown> = {
                role: resolvedRole,
                restaurant_id: resolvedRestaurantId,
                tenant_id: resolvedRestaurantId,
            };
            if (claims.must_change_password) {
                nextClaims.must_change_password = true;
            }
            await adminAuth.setCustomUserClaims(uid, nextClaims).catch(() => { });

            return NextResponse.json({
                profile: {
                    tenant_id: resolvedRestaurantId,
                    tenant_name: restData.name || resolvedRestaurantId,
                    role: resolvedRole,
                    must_change_password: Boolean(claims.must_change_password),
                    full_name: String(matchedStaffData['full_name'] || userRecord.displayName || userRecord.email || ''),
                    is_impersonating: Boolean(claims.impersonated_by_super_admin),
                    subscription_tier: restData.subscription_tier || 'starter',
                    subscription_status: effectiveStatus,
                    subscription_end_date: endDate,
                    subscription_days_remaining: daysUntilEnd,
                    subscription_ending_soon: showEndingSoonReminder,
                },
            });
        }

        // No profile found anywhere
        return NextResponse.json({ profile: null });
    } catch (error: any) {
        console.error('[/api/auth/profile] Error:', error);
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
}
