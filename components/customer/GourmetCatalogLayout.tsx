'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
    ArrowLeft,
    ArrowRight,
    Bookmark,
    CirclePlus,
    Clock3,
    Menu,
    Plus,
    Search,
    ShoppingBag,
    SlidersHorizontal,
    User,
} from 'lucide-react';
import type { MenuItem as CartMenuItem } from '@/context/CartContext';

type CatalogBranding = {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    fontFamily: string;
    catalogHeadline: string;
    featuredImages: string[];
};

type CatalogItem = CartMenuItem & { available: boolean };

type GourmetCatalogLayoutProps = {
    branding: CatalogBranding;
    categories: string[];
    activeCategory: string;
    items: CatalogItem[];
    tableId: string;
    totalItems: number;
    totalPrice: number;
    loading: boolean;
    onBack?: () => void;
    onSearch?: () => void;
    onFilter?: () => void;
    onSelectCategory: (category: string) => void;
    onAddToCart: (item: CatalogItem) => void;
    onOpenCart: () => void;
    onOpenOrders: () => void;
};

const B64_STRINGS = [
    'U0VMRUNUSU9O',
    'Q0hFQ0tPVVQgLT4=',
    'K0FERCBUTyBTRUxFQ1RJT04=',
] as const;

function decodeBase64(input: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let i = 0;

    while (i < input.length) {
        const enc1 = chars.indexOf(input.charAt(i++));
        const enc2 = chars.indexOf(input.charAt(i++));
        const enc3 = chars.indexOf(input.charAt(i++));
        const enc4 = chars.indexOf(input.charAt(i++));

        const chr1 = (enc1 << 2) | (enc2 >> 4);
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        const chr3 = ((enc3 & 3) << 6) | enc4;

        output += String.fromCharCode(chr1);
        if (enc3 !== 64) output += String.fromCharCode(chr2);
        if (enc4 !== 64) output += String.fromCharCode(chr3);
    }

    return output;
}

function formatINR(value: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
    }).format(value);
}

function imageFor(index: number, item: CatalogItem | undefined, featuredImages: string[]): string {
    if (featuredImages[index]) return featuredImages[index];
    if (item?.image) return item.image;
    return 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=1200&q=80';
}

function shortText(text: string | undefined, max = 92): string {
    if (!text) return 'Prepared with seasonal ingredients and precise technique.';
    if (text.length <= max) return text;
    return `${text.slice(0, max)}...`;
}

export function GourmetCatalogLayout({
    branding,
    categories,
    activeCategory,
    items,
    tableId,
    totalItems,
    totalPrice,
    loading,
    onBack,
    onSearch,
    onFilter,
    onSelectCategory,
    onAddToCart,
    onOpenCart,
    onOpenOrders,
}: GourmetCatalogLayoutProps) {
    const heading = (activeCategory && activeCategory !== 'All' ? activeCategory : branding.catalogHeadline || 'Mains').toUpperCase();
    const categoryStrip = categories.filter((c) => c !== 'All' && c !== activeCategory);

    const featuredItem = items[0];
    const standardItems = items.slice(1, 5);
    const listItems = items.slice(5, 12);

    const selectionLabel = decodeBase64(B64_STRINGS[0]);
    const checkoutLabel = decodeBase64(B64_STRINGS[1]);
    const addSelectionLabel = decodeBase64(B64_STRINGS[2]);

    return (
        <div
            className="min-h-screen bg-[#F8F7F4] text-slate-900 antialiased"
            style={{
                backgroundColor: branding.backgroundColor,
                fontFamily: branding.fontFamily,
            }}
        >
            <div className="mx-auto min-h-screen w-full max-w-md pb-44 md:max-w-3xl md:pb-36">
                <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/70 px-4 pb-4 pt-5 backdrop-blur-sm md:px-6">
                    <div className="mb-5 flex items-center justify-between">
                        <button
                            onClick={onBack}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
                            aria-label="Back"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onSearch}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
                                aria-label="Search"
                            >
                                <Search className="h-5 w-5" />
                            </button>
                            <button
                                onClick={onFilter}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
                                aria-label="Filter"
                            >
                                <SlidersHorizontal className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h1
                            className="text-[44px] font-black uppercase leading-none tracking-tight text-black md:text-[56px]"
                            style={{ fontFamily: 'Playfair Display, Georgia, Times New Roman, serif' }}
                        >
                            {heading}
                        </h1>

                        <div className="flex items-center gap-5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {categoryStrip.map((category) => (
                                <button
                                    key={category}
                                    onClick={() => onSelectCategory(category)}
                                    className="whitespace-nowrap text-sm font-semibold uppercase tracking-[0.14em] text-slate-400 transition hover:text-slate-600"
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                <main className="space-y-5 px-4 py-5 md:px-6">
                    {loading ? (
                        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading menu...</div>
                    ) : !featuredItem ? (
                        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">No menu items available.</div>
                    ) : (
                        <>
                            <motion.section
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
                            >
                                <div className="aspect-[16/11] w-full overflow-hidden">
                                    <img
                                        src={imageFor(0, featuredItem, branding.featuredImages)}
                                        alt={featuredItem.name}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <div className="space-y-3 p-5">
                                    <div className="flex items-end justify-between gap-3">
                                        <h2 className="text-2xl font-black tracking-tight text-black" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                                            {featuredItem.name}
                                        </h2>
                                        <p className="text-lg font-black text-black">{formatINR(featuredItem.price)}</p>
                                    </div>
                                    <p className="text-sm leading-6 text-slate-500">{shortText(featuredItem.description, 160)}</p>
                                    <button
                                        onClick={() => onAddToCart(featuredItem)}
                                        disabled={!featuredItem.available}
                                        className="w-full rounded-full border border-slate-200 bg-white py-3 text-center text-[11px] font-bold tracking-[0.16em] text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        {addSelectionLabel}
                                    </button>
                                </div>
                            </motion.section>

                            <section className="grid grid-cols-2 gap-3">
                                {standardItems.map((item, idx) => (
                                    <motion.article
                                        key={item.id}
                                        initial={{ opacity: 0, y: 14 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.04 + 0.1 }}
                                        className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
                                    >
                                        <div className="aspect-[4/5] w-full overflow-hidden">
                                            <img
                                                src={imageFor(idx + 1, item, branding.featuredImages)}
                                                alt={item.name}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                        <div className="space-y-2 p-3">
                                            <h3 className="line-clamp-1 text-sm font-bold text-black">{item.name}</h3>
                                            <p className="line-clamp-2 text-xs text-slate-500">{shortText(item.description, 72)}</p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-bold text-black">{formatINR(item.price)}</span>
                                                <button
                                                    onClick={() => onAddToCart(item)}
                                                    disabled={!item.available}
                                                    className="rounded-full border border-slate-200 p-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                                    aria-label={`Add ${item.name}`}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.article>
                                ))}
                            </section>

                            <section className="space-y-3">
                                {listItems.map((item, idx) => (
                                    <motion.article
                                        key={item.id}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.04 + 0.2 }}
                                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                                    >
                                        <img
                                            src={imageFor(idx + 5, item, branding.featuredImages)}
                                            alt={item.name}
                                            className="h-20 w-20 rounded-xl object-cover"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <h4 className="truncate text-sm font-bold text-black">{item.name}</h4>
                                            <p className="line-clamp-2 text-xs text-slate-500">{shortText(item.description, 68)}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <p className="text-sm font-bold text-black">{formatINR(item.price)}</p>
                                            <button
                                                onClick={() => onAddToCart(item)}
                                                disabled={!item.available}
                                                className="rounded-full border border-slate-200 p-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                                aria-label={`Add ${item.name}`}
                                            >
                                                <CirclePlus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </motion.article>
                                ))}
                            </section>
                        </>
                    )}
                </main>

                {totalItems > 0 ? (
                    <div className="fixed inset-x-0 bottom-20 z-50 px-4 md:bottom-24 md:px-6">
                        <div className="mx-auto flex w-full max-w-md items-center justify-between rounded-full bg-[#232528]/90 px-3 py-2 text-white shadow-xl backdrop-blur-sm md:max-w-3xl">
                            <div className="flex items-center gap-2.5 pl-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                                    <ShoppingBag className="h-4.5 w-4.5" />
                                </div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                                    {selectionLabel} {formatINR(totalPrice)}
                                </p>
                            </div>

                            <button
                                onClick={onOpenCart}
                                className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-900"
                            >
                                {checkoutLabel}
                                <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                ) : null}

                <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-sm md:px-6">
                    <div className="mx-auto grid w-full max-w-md grid-cols-4 md:max-w-3xl">
                        <button className="flex flex-col items-center gap-1 text-slate-700" aria-label="Menu">
                            <Menu className="h-5 w-5" />
                            <span className="text-[10px] font-semibold">Menu</span>
                        </button>
                        <button className="flex flex-col items-center gap-1 text-slate-400" aria-label="Saved">
                            <Bookmark className="h-5 w-5" />
                            <span className="text-[10px] font-semibold">Saved</span>
                        </button>
                        <button onClick={onOpenOrders} className="flex flex-col items-center gap-1 text-slate-500" aria-label="Orders">
                            <Clock3 className="h-5 w-5" />
                            <span className="text-[10px] font-semibold">Orders</span>
                        </button>
                        <button className="flex flex-col items-center gap-1 text-slate-400" aria-label="Profile">
                            <User className="h-5 w-5" />
                            <span className="text-[10px] font-semibold">Profile</span>
                        </button>
                    </div>
                </nav>

                {!tableId ? (
                    <div className="fixed left-1/2 top-2 z-50 -translate-x-1/2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                        Table not linked
                    </div>
                ) : null}
            </div>
        </div>
    );
}
