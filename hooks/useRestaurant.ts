import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function useRestaurant() {
    const params = useParams<{ storeId: string }>();
    const { tenantId, userRole, tenantName, subscriptionTier, tenantLoading } = useAuth();

    // The active store from the URL
    const urlStoreId = params?.storeId || '';

    // If the user is a super admin, they can view ANY storeId from the URL without restriction.
    // Otherwise, normal users are strictly bound to their authenticated tenantId.
    const isSuperAdmin = userRole === 'super_admin';
    const isAuthorized = isSuperAdmin || urlStoreId === tenantId;

    // The storeId that all queries should use.
    // For super admins, it's whatever the URL says. For normal users, it's their safe tenantId.
    const activeStoreId = isSuperAdmin && urlStoreId ? urlStoreId : tenantId;

    return {
        storeId: activeStoreId,
        isAuthorized,
        isSuperAdmin,
        // For super admins, we assume 'pro' to unlock all UI elements
        subscriptionTier: isSuperAdmin ? 'pro' : subscriptionTier,
        tenantName: isSuperAdmin ? `Admin View (${urlStoreId})` : tenantName,
        loading: tenantLoading,
    };
}
