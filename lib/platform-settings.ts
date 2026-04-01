import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from './firebase-admin';

const PLATFORM_SETTINGS_DOC = 'platform_settings/global_maintenance';

export async function getPlatformMaintenanceMode(): Promise<boolean> {
    try {
        const snap = await adminFirestore.doc(PLATFORM_SETTINGS_DOC).get();
        if (!snap.exists) return false;
        return snap.data()?.enabled === true;
    } catch (error) {
        console.error('Failed to load platform maintenance mode:', error);
        return false;
    }
}

export async function setPlatformMaintenanceMode(
    enabled: boolean,
    updatedBy: string = 'super_admin'
): Promise<void> {
    await adminFirestore.doc(PLATFORM_SETTINGS_DOC).set({
        enabled,
        updated_by: updatedBy,
        updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
}
