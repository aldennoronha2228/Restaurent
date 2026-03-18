'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
    ArrowLeft,
    ArrowRight,
    History,
    Plus,
    Search,
    ShoppingBag,
    SlidersHorizontal,
    User,
    UtensilsCrossed,
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

function formatPrice(value: number): string {
    return `$${value.toFixed(2)}`;
}

function imageFor(index: number, item: CatalogItem | undefined, featuredImages: string[]): string {
    if (featuredImages[index]) return featuredImages[index];
    if (item?.image) return item.image;
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1000&q=80';
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
    const headline = branding.catalogHeadline || activeCategory || 'Menu';
    const topCategories = categories.filter((c) => c !== 'All');

    const first = items[0];
    const second = items[1];
    const third = items[2];
    const fourth = items[3];

    return (
        <div
            className="min-h-screen text-slate-700 antialiased"
            style={{
                backgroundColor: branding.backgroundColor,
                fontFamily: branding.fontFamily,
                backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 86c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm76-52c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-3-11c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zM42 73c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm13 1c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm22-46c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zM8 55c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm20-11c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm0 24c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm5-48c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1z' fill='%23efede5' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E\")",
            }}
        >
            <div className="relative min-h-screen max-w-md mx-auto shadow-sm overflow-hidden flex flex-col" style={{ backgroundColor: branding.backgroundColor }}>
                <header className="sticky top-0 z-50 backdrop-blur-xl px-8 pt-10 pb-6" style={{ backgroundColor: `${branding.backgroundColor}E6` }}>
                    <div className="flex items-center justify-between mb-8">
                        <button
                            onClick={onBack}
                            className="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm border border-slate-100"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-400" />
                        </button>
                        <div className="flex gap-4">
                            <button
                                onClick={onSearch}
                                className="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm border border-slate-100"
                                aria-label="Search"
                            >
                                <Search className="w-5 h-5 text-slate-400" />
                            </button>
                            <button
                                onClick={onFilter}
                                className="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm border border-slate-100"
                                aria-label="Filter"
                            >
                                <SlidersHorizontal className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                    </div>

                    <h1 className="text-5xl font-extralight tracking-[0.15em] uppercase mb-8 leading-none text-slate-800">
                        {headline}
                    </h1>

                    <nav className="flex gap-8 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                        {topCategories.map((category) => {
                            const isActive = category === activeCategory;
                            return (
                                <button
                                    key={category}
                                    onClick={() => onSelectCategory(category)}
                                    className={`relative whitespace-nowrap text-xs tracking-[0.1em] uppercase transition-colors duration-500 ${
                                        isActive ? 'font-bold' : 'font-semibold text-slate-400'
                                    }`}
                                    style={{ color: isActive ? branding.primaryColor : undefined }}
                                >
                                    {category}
                                    {isActive ? (
                                        <span
                                            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                                            style={{ backgroundColor: branding.primaryColor }}
                                        />
                                    ) : null}
                                </button>
                            );
                        })}
                    </nav>
                </header>

                <main className="flex-1 px-6 pt-2 pb-32 space-y-8">
                    {loading ? (
                        <div className="py-20 text-center text-slate-500">Loading menu...</div>
                    ) : (
                        <>
                            {first ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="group relative overflow-hidden rounded-2xl bg-white border border-slate-100/50 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.04)]"
                                >
                                    <div className="aspect-[16/11] w-full overflow-hidden">
                                        <img
                                            src={imageFor(0, first, branding.featuredImages)}
                                            alt={first.name}
                                            className="w-full h-full object-cover grayscale-[0.2] transition-transform duration-1000 group-hover:scale-105"
                                        />
                                    </div>
                                    <div className="p-6">
                                        <div className="flex justify-between items-baseline mb-2">
                                            <h3 className="text-lg font-medium text-slate-800">{first.name}</h3>
                                            <span className="font-medium" style={{ color: branding.primaryColor }}>
                                                {formatPrice(first.price)}
                                            </span>
                                        </div>
                                        <p className="text-slate-400 text-xs leading-relaxed mb-6 font-light">{first.description || 'Chef-crafted signature dish.'}</p>
                                        <button
                                            onClick={() => onAddToCart(first)}
                                            disabled={!first.available}
                                            className="w-full py-4 font-bold tracking-widest uppercase rounded-xl text-[10px] flex items-center justify-center gap-2 transition-all duration-700 disabled:opacity-40"
                                            style={{
                                                backgroundColor: `${branding.primaryColor}1A`,
                                                color: branding.primaryColor,
                                            }}
                                        >
                                            <Plus className="w-4 h-4" /> Add to Selection
                                        </button>
                                    </div>
                                </motion.div>
                            ) : null}

                            <div className="grid grid-cols-2 gap-6">
                                {[second, third].filter(Boolean).map((item, idx) => {
                                    const safe = item as CatalogItem;
                                    return (
                                        <motion.div
                                            key={safe.id}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.1 + 0.1 }}
                                            className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-100/50 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.04)]"
                                        >
                                            <div className="aspect-square w-full overflow-hidden">
                                                <img
                                                    src={imageFor(idx + 1, safe, branding.featuredImages)}
                                                    alt={safe.name}
                                                    className="w-full h-full object-cover grayscale-[0.2] transition-transform duration-1000 group-hover:scale-110"
                                                />
                                            </div>
                                            <div className="p-4 flex-1 flex flex-col">
                                                <h3 className="font-medium text-sm mb-1 text-slate-800">{safe.name}</h3>
                                                <p className="text-[10px] text-slate-400 mb-4 line-clamp-2 leading-relaxed">{safe.description || 'Fresh seasonal ingredients.'}</p>
                                                <div className="mt-auto flex justify-between items-center">
                                                    <span className="font-medium text-sm" style={{ color: branding.primaryColor }}>
                                                        {formatPrice(safe.price)}
                                                    </span>
                                                    <button
                                                        onClick={() => onAddToCart(safe)}
                                                        disabled={!safe.available}
                                                        className="p-2 rounded-full transition-all duration-500 disabled:opacity-40"
                                                        style={{ backgroundColor: `${branding.primaryColor}14`, color: branding.primaryColor }}
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {fourth ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="group flex flex-row bg-white rounded-2xl overflow-hidden h-36 border border-slate-100/50 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.04)]"
                                >
                                    <div className="w-2/5 overflow-hidden">
                                        <img
                                            src={imageFor(3, fourth, branding.featuredImages)}
                                            alt={fourth.name}
                                            className="w-full h-full object-cover grayscale-[0.2] transition-transform duration-1000 group-hover:scale-110"
                                        />
                                    </div>
                                    <div className="w-3/5 p-6 flex flex-col justify-center">
                                        <div className="flex justify-between items-center mb-1 gap-2">
                                            <h3 className="font-medium text-slate-800 line-clamp-1">{fourth.name}</h3>
                                            <span className="font-medium" style={{ color: branding.primaryColor }}>
                                                {formatPrice(fourth.price)}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mb-4 leading-relaxed line-clamp-2">{fourth.description || 'Slow-cooked to perfection.'}</p>
                                        <div className="flex gap-2">
                                            <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 text-[8px] uppercase font-bold tracking-widest border border-slate-100">Chef</span>
                                            <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 text-[8px] uppercase font-bold tracking-widest border border-slate-100">Featured</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : null}
                        </>
                    )}
                </main>

                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md px-6 pointer-events-none z-40">
                    <div className="pointer-events-auto backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between border border-white/10" style={{ backgroundColor: '#1f2937f2' }}>
                        <div className="flex items-center gap-4 pl-2">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                <ShoppingBag className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[9px] opacity-60 font-semibold uppercase tracking-[0.2em]">Selection</p>
                                <p className="text-base font-bold tracking-tight">{formatPrice(totalPrice)}</p>
                            </div>
                        </div>
                        <button
                            onClick={onOpenCart}
                            className="bg-white text-slate-800 px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-100 transition-colors"
                        >
                            Checkout <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/90 backdrop-blur-xl flex justify-around items-center py-6 border-t border-slate-100 z-50">
                    <button className="flex flex-col items-center gap-2" style={{ color: branding.primaryColor }}>
                        <UtensilsCrossed className="w-5 h-5" />
                        <span className="text-[8px] font-bold uppercase tracking-[0.2em]">Menu</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 text-slate-300">
                        <ShoppingBag className="w-5 h-5" />
                        <span className="text-[8px] font-bold uppercase tracking-[0.2em]">Saved</span>
                    </button>
                    <button onClick={onOpenOrders} className="flex flex-col items-center gap-2 text-slate-300 hover:transition-colors" style={{ color: totalItems > 0 ? branding.secondaryColor : undefined }}>
                        <History className="w-5 h-5" />
                        <span className="text-[8px] font-bold uppercase tracking-[0.2em]">Orders</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 text-slate-300">
                        <User className="w-5 h-5" />
                        <span className="text-[8px] font-bold uppercase tracking-[0.2em]">Profile</span>
                    </button>
                </nav>

                {!tableId ? (
                    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[10px] font-semibold text-amber-700 uppercase tracking-[0.12em]">
                        No table linked
                    </div>
                ) : null}
            </div>
        </div>
    );
}
