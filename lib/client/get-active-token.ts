import { onAuthStateChanged } from 'firebase/auth';
import { adminAuth, tenantAuth } from '@/lib/firebase';

type TokenOptions = {
    tenantSessionToken?: string | null;
    superAdminSessionToken?: string | null;
    waitForAuthMs?: number;
};

async function tokenFromFirebaseUsers(): Promise<string | null> {
    if (tenantAuth.currentUser) return tenantAuth.currentUser.getIdToken(true);
    if (adminAuth.currentUser) return adminAuth.currentUser.getIdToken(true);
    return null;
}

async function waitForAuthResolution(timeoutMs: number): Promise<void> {
    if (tenantAuth.currentUser || adminAuth.currentUser) return;

    await new Promise<void>((resolve) => {
        let settled = false;

        const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            unsubTenant();
            unsubAdmin();
            resolve();
        };

        const timer = setTimeout(finish, timeoutMs);
        const unsubTenant = onAuthStateChanged(tenantAuth, () => finish());
        const unsubAdmin = onAuthStateChanged(adminAuth, () => finish());
    });
}

export async function getActiveToken(options: TokenOptions = {}): Promise<string> {
    const {
        tenantSessionToken = null,
        superAdminSessionToken = null,
        waitForAuthMs = 1200,
    } = options;

    const directToken = await tokenFromFirebaseUsers();
    if (directToken) return directToken;

    if (superAdminSessionToken) return superAdminSessionToken;
    if (tenantSessionToken) return tenantSessionToken;

    await waitForAuthResolution(waitForAuthMs);

    const postWaitToken = await tokenFromFirebaseUsers();
    if (postWaitToken) return postWaitToken;

    if (superAdminSessionToken) return superAdminSessionToken;
    if (tenantSessionToken) return tenantSessionToken;

    throw new Error('Missing active session');
}
