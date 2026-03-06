'use client';

/**
 * Custom Branding Settings (Pro-only feature)
 * Allows restaurants to customize their menu colors, logo, and styling
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { 
    Palette, Upload, Eye, Save, RefreshCw,
    Type, Image, Sparkles
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ProFeatureGate } from '@/components/dashboard/ProFeatureGate';
import { RoleGuard } from '@/components/dashboard/RoleGuard';
import { cn } from '@/lib/utils';

const colorPresets = [
    { name: 'Ocean Blue', primary: '#3B82F6', secondary: '#0EA5E9' },
    { name: 'Forest Green', primary: '#22C55E', secondary: '#10B981' },
    { name: 'Royal Purple', primary: '#8B5CF6', secondary: '#A855F7' },
    { name: 'Sunset Orange', primary: '#F97316', secondary: '#FB923C' },
    { name: 'Rose Pink', primary: '#EC4899', secondary: '#F472B6' },
    { name: 'Slate Gray', primary: '#475569', secondary: '#64748B' },
];

function BrandingContent() {
    const [primaryColor, setPrimaryColor] = useState('#3B82F6');
    const [secondaryColor, setSecondaryColor] = useState('#6366F1');
    const [logoUrl, setLogoUrl] = useState('');
    const [fontFamily, setFontFamily] = useState('Inter');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        // Simulate API call
        await new Promise(r => setTimeout(r, 1000));
        setSaving(false);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Custom Branding</h1>
                    <p className="text-slate-500 text-sm mt-1">Personalize your restaurant's digital menu appearance</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                        <Eye className="w-4 h-4" />
                        Preview
                    </button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : 'Save Changes'}
                    </motion.button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Color Settings */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-slate-200 p-6"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <Palette className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Brand Colors</h2>
                            <p className="text-sm text-slate-500">Choose your primary and secondary colors</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Primary Color</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm uppercase"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Secondary Color</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={secondaryColor}
                                    onChange={(e) => setSecondaryColor(e.target.value)}
                                    className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={secondaryColor}
                                    onChange={(e) => setSecondaryColor(e.target.value)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm uppercase"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">Color Presets</label>
                            <div className="grid grid-cols-3 gap-2">
                                {colorPresets.map((preset) => (
                                    <button
                                        key={preset.name}
                                        onClick={() => {
                                            setPrimaryColor(preset.primary);
                                            setSecondaryColor(preset.secondary);
                                        }}
                                        className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
                                    >
                                        <div className="flex gap-1">
                                            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: preset.primary }} />
                                            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: preset.secondary }} />
                                        </div>
                                        <span className="text-xs text-slate-600">{preset.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Logo & Font */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-6"
                >
                    {/* Logo Upload */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                <Image className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Restaurant Logo</h2>
                                <p className="text-sm text-slate-500">Upload your logo (PNG, JPG, max 2MB)</p>
                            </div>
                        </div>

                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
                            <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                            <p className="text-sm text-slate-600 mb-1">Drop your logo here or click to browse</p>
                            <p className="text-xs text-slate-400">Recommended: 512x512px</p>
                        </div>
                    </div>

                    {/* Font Selection */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                                <Type className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Typography</h2>
                                <p className="text-sm text-slate-500">Choose your menu font style</p>
                            </div>
                        </div>

                        <select
                            value={fontFamily}
                            onChange={(e) => setFontFamily(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                            <option value="Inter">Inter (Modern)</option>
                            <option value="Playfair Display">Playfair Display (Elegant)</option>
                            <option value="Poppins">Poppins (Friendly)</option>
                            <option value="Roboto">Roboto (Clean)</option>
                            <option value="Lora">Lora (Classic)</option>
                        </select>

                        <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                            <p className="text-xs text-slate-400 mb-2">Preview:</p>
                            <p className="text-xl font-bold text-slate-900" style={{ fontFamily }}>
                                Your Restaurant Name
                            </p>
                            <p className="text-sm text-slate-600 mt-1" style={{ fontFamily }}>
                                Delicious food, unforgettable experience
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Live Preview */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl border border-slate-200 p-6"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Live Preview</h2>
                        <p className="text-sm text-slate-500">See how your menu will look to customers</p>
                    </div>
                </div>

                <div 
                    className="rounded-xl overflow-hidden"
                    style={{ backgroundColor: `${primaryColor}10` }}
                >
                    <div 
                        className="h-20 flex items-center justify-center"
                        style={{ backgroundColor: primaryColor }}
                    >
                        <h3 className="text-white text-xl font-bold" style={{ fontFamily }}>
                            Your Restaurant
                        </h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm">
                            <div>
                                <p className="font-semibold text-slate-900" style={{ fontFamily }}>Butter Chicken</p>
                                <p className="text-sm text-slate-500">Creamy tomato-based curry</p>
                            </div>
                            <span className="font-bold" style={{ color: primaryColor }}>₹350</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm">
                            <div>
                                <p className="font-semibold text-slate-900" style={{ fontFamily }}>Paneer Tikka</p>
                                <p className="text-sm text-slate-500">Grilled cottage cheese</p>
                            </div>
                            <span className="font-bold" style={{ color: primaryColor }}>₹280</span>
                        </div>
                        <button 
                            className="w-full py-3 rounded-xl text-white font-semibold transition-opacity hover:opacity-90"
                            style={{ backgroundColor: secondaryColor }}
                        >
                            Add to Cart
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default function BrandingPage() {
    return (
        <RoleGuard requiredPermission="can_view_branding">
            <ProFeatureGate 
                feature="Custom Branding" 
                description="Create a unique look for your digital menu with custom colors, logo, and typography that matches your restaurant's identity."
            >
                <BrandingContent />
            </ProFeatureGate>
        </RoleGuard>
    );
}
