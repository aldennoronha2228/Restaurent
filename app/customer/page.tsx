'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import type { MenuItem as CartMenuItem } from '@/context/CartContext';
import { CartDrawer } from '@/components/customer/CartDrawer';
import { GourmetCatalogLayout } from '@/components/customer/GourmetCatalogLayout';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { db, tenantAuth, adminAuth } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { applyAvailabilityOverrides, seedAvailabilityMap } from '@/lib/menuAvailability';

// Fallback static items in case Firebase isn't set up yet
import { menuItems as staticItems, categories as staticCategories } from '@/data/menuData';

// Firestore item shape → CartMenuItem shape
interface FirestoreItem {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    available: boolean;
    category_id?: string;
    category_name?: string;
    category?: string;
    type?: 'veg' | 'non-veg' | string;
}

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
    primaryColor: '#1B4332',
    secondaryColor: '#D4AF37',
    backgroundColor: '#FDFCF8',
    fontFamily: 'Inter',
    logoUrl: '',
    heroImageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&q=80',
    heroOverlayOpacity: 60,
    heroHeadline: 'Culinary Excellence',
    heroTagline: 'Discover our exquisite menu crafted by world-class chefs',
    showHeroSection: true,
    catalogHeadline: '',
    featuredImages: [],
};

const LAST_TABLE_STORAGE_KEY = 'nexresto:last-table-id';

function normalizeBranding(raw: any): CustomerBranding {
    const overlay = Number(raw?.heroOverlayOpacity);
    const featuredImages = Array.isArray(raw?.featuredImages)
        ? raw.featuredImages.filter((v: unknown) => typeof v === 'string').map((v: string) => v.trim()).filter(Boolean)
        : [];

    return {
        primaryColor: typeof raw?.primaryColor === 'string' ? raw.primaryColor : DEFAULT_BRANDING.primaryColor,
        secondaryColor: typeof raw?.secondaryColor === 'string' ? raw.secondaryColor : DEFAULT_BRANDING.secondaryColor,
        backgroundColor: typeof raw?.backgroundColor === 'string' ? raw.backgroundColor : DEFAULT_BRANDING.backgroundColor,
        fontFamily: typeof raw?.fontFamily === 'string' ? raw.fontFamily : DEFAULT_BRANDING.fontFamily,
        logoUrl: typeof raw?.logoUrl === 'string' ? raw.logoUrl : DEFAULT_BRANDING.logoUrl,
        heroImageUrl: typeof raw?.heroImageUrl === 'string' && raw.heroImageUrl ? raw.heroImageUrl : DEFAULT_BRANDING.heroImageUrl,
        heroOverlayOpacity: Number.isFinite(overlay) ? Math.max(0, Math.min(100, overlay)) : DEFAULT_BRANDING.heroOverlayOpacity,
        heroHeadline: typeof raw?.heroHeadline === 'string' && raw.heroHeadline ? raw.heroHeadline : DEFAULT_BRANDING.heroHeadline,
        heroTagline: typeof raw?.heroTagline === 'string' && raw.heroTagline ? raw.heroTagline : DEFAULT_BRANDING.heroTagline,
        showHeroSection: typeof raw?.showHeroSection === 'boolean' ? raw.showHeroSection : DEFAULT_BRANDING.showHeroSection,
        catalogHeadline: typeof raw?.catalogHeadline === 'string' ? raw.catalogHeadline : DEFAULT_BRANDING.catalogHeadline,
        featuredImages,
    };
}

function toCartItem(
    f: FirestoreItem,
    categoryName: string,
    fallback?: CartMenuItem
): CartMenuItem & { available: boolean; type?: 'veg' | 'non-veg' } {
    const normalizedType = String(f.type || '').toLowerCase();
    const type = normalizedType === 'non-veg' || normalizedType === 'nonveg'
        ? 'non-veg'
        : normalizedType === 'veg'
            ? 'veg'
            : undefined;

    return {
        id: f.id,
        name: f.name,
        description: fallback?.description ?? '',
        price: f.price,
        image: f.image_url ?? fallback?.image ?? 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
        category: categoryName ?? fallback?.category ?? 'Other',
        available: f.available ?? true,
        type,
    };
}

function CustomerMenuContent() {
    const [activeCategory, setActiveCategory] = useState('All');
    const [menuItems, setMenuItems] = useState<(CartMenuItem & { available: boolean })[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [retryNonce, setRetryNonce] = useState(0);
    const { addToCart, setIsCartOpen, totalItems, totalPrice } = useCart();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tableIdFromQuery =
        searchParams.get('table') ??
        searchParams.get('tableId') ??
        searchParams.get('table_id') ??
        searchParams.get('t') ??
        '';
    const [resolvedTableId, setResolvedTableId] = useState('');
    const restaurantId = searchParams.get('restaurant') ?? '';
    const isPreviewMode = searchParams.get('preview') === '1';
    const [branding, setBranding] = useState<CustomerBranding>(DEFAULT_BRANDING);
    const [previewBranding, setPreviewBranding] = useState<CustomerBranding | null>(null);

    const buildCustomerUrl = (path: string) => {
        const params = new URLSearchParams();
        if (resolvedTableId) params.set('table', resolvedTableId);
        if (restaurantId) params.set('restaurant', restaurantId);
        const qs = params.toString();
        return `${path}${qs ? `?${qs}` : ''}`;
    };

    useEffect(() => {
        const normalized = (tableIdFromQuery || '').trim();
        if (normalized) {
            setResolvedTableId(normalized);
            localStorage.setItem(LAST_TABLE_STORAGE_KEY, normalized);
            return;
        }

        const remembered = (localStorage.getItem(LAST_TABLE_STORAGE_KEY) || '').trim();
        setResolvedTableId(remembered);
    }, [tableIdFromQuery]);

    const refreshTokens = async () => {
        const jobs: Promise<unknown>[] = [];
        if (tenantAuth.currentUser) jobs.push(tenantAuth.currentUser.getIdToken(true));
        if (adminAuth.currentUser) jobs.push(adminAuth.currentUser.getIdToken(true));
        if (jobs.length > 0) {
            await Promise.allSettled(jobs);
        }
    };

    useEffect(() => {
        let active = true;

        const loadBranding = async () => {
            if (!restaurantId) {
                if (active) setBranding(DEFAULT_BRANDING);
                return;
            }

            try {
                const res = await fetch(`/api/tenant/branding?restaurantId=${encodeURIComponent(restaurantId)}`);
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(payload?.error || 'Failed to load branding');
                if (!active) return;
                setBranding(normalizeBranding(payload));
            } catch {
                if (active) setBranding(DEFAULT_BRANDING);
            }
        };

        loadBranding();
        return () => { active = false; };
    }, [restaurantId]);

    useEffect(() => {
        let active = true;

        const enforceAccess = async () => {
            if (!restaurantId) return;
            try {
                const res = await fetch(`/api/tenant/access?restaurantId=${encodeURIComponent(restaurantId)}`, {
                    cache: 'no-store',
                });
                if (!res.ok) return;
                const data = await res.json();
                if (active && data?.accountTemporarilyDisabled) {
                    router.replace('/maintenance');
                }
            } catch {
                // Keep customer page available if access check fails unexpectedly.
            }
        };

        enforceAccess();
        return () => { active = false; };
    }, [restaurantId, router]);

    useEffect(() => {
        if (!isPreviewMode) return;

        const handler = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            const message = event.data;
            if (!message || message.type !== 'NEXRESTO_BRANDING_PREVIEW') return;
            setPreviewBranding(normalizeBranding(message.payload || {}));
        };

        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [isPreviewMode]);

    // Fetch live menu from Firestore; fall back to static data if not configured
    useEffect(() => {
        let cancelled = false;
        const resolvedTenantId = restaurantId;

        async function loadMenu() {
            try {
                if (!resolvedTenantId) {
                    if (!cancelled) {
                        setMenuItems([]);
                        setCategories(['All']);
                        setLoading(false);
                    }
                    return;
                }

                const tenantId = resolvedTenantId;

                // 1. Fetch Categories
                const catsQuery = query(
                    collection(db, 'restaurants', tenantId, 'categories'),
                    orderBy('display_order')
                );
                let catsSnap;
                try {
                    catsSnap = await getDocs(catsQuery);
                } catch (err: any) {
                    const code = typeof err?.code === 'string' ? err.code : '';
                    if (code.includes('permission-denied')) {
                        await refreshTokens();
                        catsSnap = await getDocs(catsQuery);
                    } else {
                        throw err;
                    }
                }
                const catMap = new Map<string, string>(); // category_id -> name
                const catNames: string[] = [];

                catsSnap.forEach(doc => {
                    const data = doc.data();
                    catMap.set(doc.id, data.name);
                    catNames.push(data.name);
                });

                // 2. Fetch Menu Items
                const itemsQuery = query(
                    collection(db, 'restaurants', tenantId, 'menu_items'),
                    orderBy('name')
                );
                let itemsSnap;
                try {
                    itemsSnap = await getDocs(itemsQuery);
                } catch (err: any) {
                    const code = typeof err?.code === 'string' ? err.code : '';
                    if (code.includes('permission-denied')) {
                        await refreshTokens();
                        itemsSnap = await getDocs(itemsQuery);
                    } else {
                        throw err;
                    }
                }

                const items: any[] = [];
                itemsSnap.forEach(doc => {
                    items.push({ id: doc.id, ...doc.data() });
                });

                if (cancelled) return;

                // Enrich with static descriptions/images where Firestore row has none
                const normalizedCatNames = new Set(catNames.map((c) => c.trim().toLowerCase()));

                const enriched = items.map((f: FirestoreItem) => {
                    const fallback = staticItems.find(
                        si => si.name.toLowerCase() === f.name.toLowerCase()
                    );
                    const categoryFromId = f.category_id ? catMap.get(f.category_id) : '';
                    const categoryFromName = String(f.category_name || '').trim();
                    const categoryFromLegacy = String(f.category || '').trim();

                    // Prefer explicit category_id mapping; only accept name/legacy if it matches an existing preset category.
                    const categoryName = (
                        categoryFromId ||
                        (normalizedCatNames.has(categoryFromName.toLowerCase()) ? categoryFromName : '') ||
                        (normalizedCatNames.has(categoryFromLegacy.toLowerCase()) ? categoryFromLegacy : '') ||
                        fallback?.category ||
                        catNames[0] ||
                        'Other'
                    );
                    return toCartItem(f, categoryName, fallback);
                });

                // Seed localStorage so overrides are initialised from DB state
                seedAvailabilityMap(enriched.map(i => ({ id: i.id, available: i.available })), tenantId);
                // Apply any manual overrides saved by the dashboard
                setMenuItems(applyAvailabilityOverrides(enriched, tenantId));
                setCategories(['All', ...catNames]);
            } catch (err) {
                console.error('Failed to load menu from Firestore:', err);
                // Firestore not available — use static fallback + localStorage overrides
                if (cancelled) return;
                const base = staticItems.map(i => ({ ...i, available: true }));
                setMenuItems(applyAvailabilityOverrides(base, resolvedTenantId || ''));
                setCategories(staticCategories);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadMenu();
        return () => { cancelled = true; };
    }, [restaurantId, retryNonce]);

    // Subscribe to real-time availability changes
    useEffect(() => {
        const tenantId = restaurantId;
        if (!tenantId) return;

        const unsubscribe = onSnapshot(
            collection(db, 'restaurants', tenantId, 'menu_items'),
            (snapshot) => {
                let hasChanges = false;
                const updates = new Map();

                snapshot.docChanges().forEach(change => {
                    if (change.type === 'modified') {
                        hasChanges = true;
                        updates.set(change.doc.id, change.doc.data().available);
                    }
                });

                if (hasChanges) {
                    setMenuItems(prev =>
                        prev.map(item =>
                            updates.has(item.id)
                                ? { ...item, available: updates.get(item.id) }
                                : item
                        )
                    );

                    // Keep localStorage in sync with Firestore real-time changes
                    updates.forEach((available, id) => {
                        import('@/lib/menuAvailability').then(m =>
                            m.setItemAvailability(id, available, tenantId)
                        );
                    });
                }
            },
            async (error: any) => {
                const code = typeof error?.code === 'string' ? error.code : '';
                if (code.includes('permission-denied')) {
                    await refreshTokens();
                    setRetryNonce((n) => n + 1);
                    return;
                }
                console.error('[CustomerMenu] snapshot error:', error);
            }
        );

        return () => { unsubscribe(); };
    }, [restaurantId]);

    const effectiveBranding = previewBranding || branding;

    return (
        <div className="min-h-screen">
            <GourmetCatalogLayout
                branding={effectiveBranding}
                categories={categories}
                activeCategory={activeCategory}
                items={menuItems}
                tableId={resolvedTableId}
                totalItems={totalItems}
                totalPrice={totalPrice}
                loading={loading}
                onBack={() => router.back()}
                onSearch={() => setIsCartOpen(true)}
                onFilter={() => setActiveCategory('All')}
                onSelectCategory={setActiveCategory}
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

export default function CustomerMenuPage() {
    return <Suspense><CustomerMenuContent /></Suspense>;
}
