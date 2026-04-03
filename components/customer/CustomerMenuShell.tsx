'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useCart } from '@/context/CartContext';
import { db, tenantAuth, adminAuth } from '@/lib/firebase';
import { applyAvailabilityOverrides, seedAvailabilityMap } from '@/lib/menuAvailability';
import { getOptimizedHeroImageSrc, getOptimizedMenuItemImageSrc } from '@/lib/image-optimization';
import { getTenantTableStorageKey } from '@/lib/client/storage/tenantKeys';
import MenuCatalogLayout from './MenuCatalogLayout';
import { CartDrawer } from './CartDrawer';

type FirestoreItem = {
    id: string;
    name: string;
    price: number;
    image_url?: string | null;
    available?: boolean;
    category_id?: string;
    category_name?: string;
    category?: string;
    type?: string;
};

type CustomerBranding = {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    fontFamily: string;
    logoUrl: string;
    heroImageUrl: string;
    heroOverlayOpacity: number;
    heroHeadline: string;
    heroTagline: string;
    showHeroSection: boolean;
    catalogHeadline: string;
    featuredImages: string[];
};

const DEFAULT_BRANDING: CustomerBranding = {
    primaryColor: '#3e54d3',
    secondaryColor: '#10b981',
    backgroundColor: '#131313',
    fontFamily: 'Inter, sans-serif',
    logoUrl: '',
    heroImageUrl: getOptimizedHeroImageSrc(''),
    heroOverlayOpacity: 60,
    heroHeadline: 'NexResto Customer Menu',
    heroTagline: 'Curated dishes for your table.',
    showHeroSection: true,
    catalogHeadline: '',
    featuredImages: [],
};

type CustomerMenuShellProps = {
    restaurantIdOverride?: string;
    tenantHomePath?: string;
    restaurantName?: string;
};

function normalizeBranding(raw: unknown): CustomerBranding {
    if (!raw || typeof raw !== 'object') return DEFAULT_BRANDING;
    const source = raw as Record<string, unknown>;

    return {
        ...DEFAULT_BRANDING,
        primaryColor: typeof source.primaryColor === 'string' ? source.primaryColor : DEFAULT_BRANDING.primaryColor,
        secondaryColor: typeof source.secondaryColor === 'string' ? source.secondaryColor : DEFAULT_BRANDING.secondaryColor,
        backgroundColor: typeof source.backgroundColor === 'string' ? source.backgroundColor : DEFAULT_BRANDING.backgroundColor,
        fontFamily: typeof source.fontFamily === 'string' ? source.fontFamily : DEFAULT_BRANDING.fontFamily,
        logoUrl: typeof source.logoUrl === 'string' ? source.logoUrl : DEFAULT_BRANDING.logoUrl,
        heroImageUrl: getOptimizedHeroImageSrc(typeof source.heroImageUrl === 'string' ? source.heroImageUrl : ''),
        heroOverlayOpacity: typeof source.heroOverlayOpacity === 'number' ? source.heroOverlayOpacity : DEFAULT_BRANDING.heroOverlayOpacity,
        heroHeadline: typeof source.heroHeadline === 'string' && source.heroHeadline ? source.heroHeadline : DEFAULT_BRANDING.heroHeadline,
        heroTagline: typeof source.heroTagline === 'string' && source.heroTagline ? source.heroTagline : DEFAULT_BRANDING.heroTagline,
        showHeroSection: typeof source.showHeroSection === 'boolean' ? source.showHeroSection : DEFAULT_BRANDING.showHeroSection,
        catalogHeadline: typeof source.catalogHeadline === 'string' ? source.catalogHeadline : DEFAULT_BRANDING.catalogHeadline,
        featuredImages: Array.isArray(source.featuredImages)
            ? source.featuredImages.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            : [],
    };
}

async function refreshTokens() {
    const jobs: Promise<unknown>[] = [];
    if (tenantAuth.currentUser) jobs.push(tenantAuth.currentUser.getIdToken(true));
    if (adminAuth.currentUser) jobs.push(adminAuth.currentUser.getIdToken(true));
    if (jobs.length > 0) {
        await Promise.allSettled(jobs);
    }
}

function normalizeType(type: string | undefined): 'veg' | 'non-veg' | undefined {
    const t = String(type || '').toLowerCase();
    if (t === 'veg') return 'veg';
    if (t === 'non-veg' || t === 'nonveg') return 'non-veg';
    return undefined;
}

function getErrorCode(error: unknown): string {
    if (!error || typeof error !== 'object') return '';
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : '';
}

export function CustomerMenuShell({ restaurantIdOverride, tenantHomePath, restaurantName }: CustomerMenuShellProps) {
    const [categories, setCategories] = React.useState<string[]>(['All']);
    const [menuItems, setMenuItems] = React.useState<Array<{ id: string; name: string; description: string; price: number; image: string; category: string; available: boolean; type?: 'veg' | 'non-veg' }>>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [branding, setBranding] = React.useState<CustomerBranding>(DEFAULT_BRANDING);

    const { addToCart, setIsCartOpen, totalItems, totalPrice } = useCart();
    const router = useRouter();
    const searchParams = useSearchParams();

    const queryTableId = searchParams.get('table') ?? searchParams.get('tableId') ?? searchParams.get('table_id') ?? searchParams.get('t') ?? '';
    const restaurantFromQuery = searchParams.get('restaurant') ?? '';
    const restaurantId = (restaurantIdOverride || restaurantFromQuery || '').trim();
    const [resolvedTableId, setResolvedTableId] = React.useState('');

    React.useEffect(() => {
        const normalized = queryTableId.trim();
        if (normalized) {
            setResolvedTableId(normalized);
            if (restaurantId) {
                localStorage.setItem(getTenantTableStorageKey(restaurantId), normalized);
            }
            return;
        }

        if (!restaurantId) {
            setResolvedTableId('');
            return;
        }

        setResolvedTableId((localStorage.getItem(getTenantTableStorageKey(restaurantId)) || '').trim());
    }, [queryTableId, restaurantId]);

    React.useEffect(() => {
        let active = true;

        const loadBranding = async () => {
            if (!restaurantId) {
                if (active) setBranding(DEFAULT_BRANDING);
                return;
            }

            try {
                const res = await fetch(`/api/tenant/branding?restaurantId=${encodeURIComponent(restaurantId)}`);
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(String(payload?.error || 'Failed branding load'));
                if (active) setBranding(normalizeBranding(payload));
            } catch {
                if (active) setBranding(DEFAULT_BRANDING);
            }
        };

        loadBranding();
        return () => {
            active = false;
        };
    }, [restaurantId]);

    React.useEffect(() => {
        let cancelled = false;

        const loadMenu = async () => {
            setLoading(true);
            setError(null);

            if (!restaurantId) {
                setCategories(['All']);
                setMenuItems([]);
                setError('Missing restaurant context in URL.');
                setLoading(false);
                return;
            }

            try {
                const catsQuery = query(collection(db, 'restaurants', restaurantId, 'categories'), orderBy('display_order'));
                const itemsQuery = query(collection(db, 'restaurants', restaurantId, 'menu_items'), orderBy('name'));

                let catsSnap;
                try {
                    catsSnap = await getDocs(catsQuery);
                } catch (err: unknown) {
                    if (getErrorCode(err).includes('permission-denied')) {
                        await refreshTokens();
                        catsSnap = await getDocs(catsQuery);
                    } else {
                        throw err;
                    }
                }

                let itemsSnap;
                try {
                    itemsSnap = await getDocs(itemsQuery);
                } catch (err: unknown) {
                    if (getErrorCode(err).includes('permission-denied')) {
                        await refreshTokens();
                        itemsSnap = await getDocs(itemsQuery);
                    } else {
                        throw err;
                    }
                }

                if (cancelled) return;

                const categoryMap = new Map<string, string>();
                const categoryNames: string[] = [];
                catsSnap.forEach((doc) => {
                    const row = doc.data() as Record<string, unknown>;
                    const name = String(row.name || '').trim();
                    if (name) {
                        categoryMap.set(doc.id, name);
                        categoryNames.push(name);
                    }
                });

                const normalizedCategorySet = new Set(categoryNames.map((c) => c.toLowerCase()));

                const rawItems: FirestoreItem[] = [];
                itemsSnap.forEach((doc) => rawItems.push({ id: doc.id, ...(doc.data() as Omit<FirestoreItem, 'id'>) }));

                const mapped = rawItems
                    .map((row) => {
                        const fromId = row.category_id ? categoryMap.get(row.category_id) : '';
                        const fromName = String(row.category_name || '').trim();
                        const fromLegacy = String(row.category || '').trim();

                        const resolvedCategory =
                            fromId ||
                            (normalizedCategorySet.has(fromName.toLowerCase()) ? fromName : '') ||
                            (normalizedCategorySet.has(fromLegacy.toLowerCase()) ? fromLegacy : '') ||
                            'Others';

                        return {
                            id: row.id,
                            name: String(row.name || 'Unnamed Item'),
                            description: '',
                            price: Number(row.price || 0),
                            image: getOptimizedMenuItemImageSrc(row.image_url),
                            category: resolvedCategory,
                            available: row.available !== false,
                            type: normalizeType(row.type),
                        };
                    });

                seedAvailabilityMap(mapped.map((m) => ({ id: m.id, available: m.available })), restaurantId);
                const overridden = applyAvailabilityOverrides(mapped, restaurantId);

                setCategories(['All', ...categoryNames]);
                setMenuItems(overridden);
            } catch {
                if (cancelled) return;
                setError('Could not load menu for this restaurant.');
                setCategories(['All']);
                setMenuItems([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadMenu();

        return () => {
            cancelled = true;
        };
    }, [restaurantId]);

    React.useEffect(() => {
        if (!restaurantId) return;

        const unsubscribe = onSnapshot(
            collection(db, 'restaurants', restaurantId, 'menu_items'),
            (snap) => {
                const updates = new Map<string, boolean>();
                snap.docChanges().forEach((change) => {
                    if (change.type === 'modified') {
                        const row = change.doc.data() as Record<string, unknown>;
                        updates.set(change.doc.id, row.available !== false);
                    }
                });

                if (updates.size === 0) return;

                setMenuItems((prev) =>
                    prev.map((item) => (updates.has(item.id) ? { ...item, available: Boolean(updates.get(item.id)) } : item))
                );
            },
            async (err) => {
                if (getErrorCode(err).includes('permission-denied')) {
                    await refreshTokens();
                }
            }
        );

        return () => unsubscribe();
    }, [restaurantId]);

    const buildCustomerUrl = (path: string): string => {
        const params = new URLSearchParams();
        if (resolvedTableId) params.set('table', resolvedTableId);
        if (restaurantId) params.set('restaurant', restaurantId);
        return `${path}${params.toString() ? `?${params.toString()}` : ''}`;
    };

    return (
        <div className="min-h-screen">
            {error && (
                <div className="mx-auto max-w-6xl px-4 pt-4">
                    <div className="rounded border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
                </div>
            )}
            <MenuCatalogLayout
                branding={branding}
                categories={categories}
                items={menuItems}
                tableId={resolvedTableId}
                restaurantName={restaurantName || restaurantId || 'Restaurant'}
                totalItems={totalItems}
                totalPrice={totalPrice}
                loading={loading}
                onSearch={() => setIsCartOpen(true)}
                onSelectCategory={() => {
                    // Filtering is handled in the layout component.
                }}
                onAddToCart={(item) => {
                    if (item.available) addToCart(item);
                }}
                onOpenCart={() => setIsCartOpen(true)}
                onOpenOrders={() => router.push(buildCustomerUrl('/customer/order-history'))}
            />
            <CartDrawer tableId={resolvedTableId} restaurantId={restaurantId || undefined} />
        </div>
    );
}
