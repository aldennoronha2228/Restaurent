import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { securityLog } from '@/lib/logger';

export type TenantAccessLevel = 'read' | 'manage';

export type TenantAuthorization = {
    uid: string;
    role: string;
    isSuperAdmin: boolean;
};

function normalizeRole(role: unknown): string {
    return String(role || '').trim().toLowerCase();
}

function isAllowedRole(role: string, level: TenantAccessLevel): boolean {
    if (role === 'super_admin') return true;
    if (level === 'manage') {
        return role === 'owner' || role === 'admin';
    }
    return (
        role === 'owner' ||
        role === 'admin' ||
        role === 'manager' ||
        role === 'staff' ||
        role === 'kitchen'
    );
}

export async function authorizeTenantAccess(
    idToken: string,
    restaurantId: string,
    level: TenantAccessLevel = 'read'
): Promise<TenantAuthorization | null> {
    try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        const user = await adminAuth.getUser(decoded.uid);
        const claims = user.customClaims || {};

        const role = normalizeRole(claims.role);
        if (role === 'super_admin') {
            return { uid: decoded.uid, role, isSuperAdmin: true };
        }

        const claimRestaurantId = String(claims.restaurant_id || claims.tenant_id || '').trim();
        if (claimRestaurantId === restaurantId && isAllowedRole(role, level)) {
            securityLog.info('AUTHZ_ADMIN_CHECK', {
                userId: decoded.uid,
                restaurantId,
                level,
                role,
                source: 'claims',
                allowed: true,
            });
            return { uid: decoded.uid, role, isSuperAdmin: false };
        }

        // Stale-claims fallback: check live staff role inside requested tenant.
        const staffDoc = await adminFirestore.doc(`restaurants/${restaurantId}/staff/${decoded.uid}`).get();
        const staffRole = normalizeRole(staffDoc.data()?.role);
        if (staffDoc.exists && isAllowedRole(staffRole, level)) {
            securityLog.info('AUTHZ_ADMIN_CHECK', {
                userId: decoded.uid,
                restaurantId,
                level,
                role: staffRole,
                source: 'staff_doc',
                allowed: true,
            });
            return { uid: decoded.uid, role: staffRole, isSuperAdmin: false };
        }

        securityLog.warn('AUTHZ_DENIED', {
            userId: decoded.uid,
            restaurantId,
            level,
            claimRole: role,
            claimRestaurantId,
            staffDocExists: staffDoc.exists,
        });

        return null;
    } catch (error) {
        securityLog.error('AUTHZ_DENIED', {
            restaurantId,
            level,
            reason: 'authz_exception',
            message: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
