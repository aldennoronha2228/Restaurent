'use client';

/**
 * Premium Upgrade Modal
 * High-converting modal shown to Starter tier users when they try to access Pro features
 */

import { motion, AnimatePresence } from 'motion/react';
import { 
    X, Sparkles, BarChart3, Package, Palette, 
    QrCode, Users, CheckCircle2, Crown, Zap, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    featureName?: string;
}

const proFeatures = [
    { icon: BarChart3, title: 'Analytics Dashboard', description: 'Track revenue, orders, and customer insights' },
    { icon: Package, title: 'Inventory Management', description: 'Real-time stock tracking with low-stock alerts' },
    { icon: Palette, title: 'Custom Branding', description: 'Custom colors, logo, and menu styling' },
    { icon: QrCode, title: 'Visual Floor Plan', description: 'Drag-and-drop table layout editor' },
    { icon: Users, title: 'Staff Management', description: 'Role-based access for your team' },
];

export function UpgradeModal({ isOpen, onClose, featureName }: UpgradeModalProps) {
    const handleRequestUpgrade = () => {
        // In production, this would send an email notification to super admin
        // or redirect to a payment page
        alert('Upgrade request sent! Our team will contact you shortly.');
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border border-slate-700/50 w-full max-w-lg overflow-hidden"
                    >
                        {/* Decorative gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent pointer-events-none" />
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-500/20 blur-3xl rounded-full -translate-y-1/2 pointer-events-none" />
                        
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/50 hover:bg-slate-700/50 transition-colors z-10"
                        >
                            <X className="w-5 h-5 text-slate-400" />
                        </button>

                        <div className="relative p-6 sm:p-8">
                            {/* Header */}
                            <div className="text-center mb-6">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 shadow-lg shadow-purple-500/30">
                                    <Crown className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">
                                    Unlock {featureName || 'Pro Features'}
                                </h2>
                                <p className="text-slate-400 text-sm">
                                    Upgrade to Pro and supercharge your restaurant operations
                                </p>
                            </div>

                            {/* Pricing */}
                            <div className="relative bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl p-4 mb-6 border border-purple-500/30">
                                <div className="flex items-baseline justify-center gap-1">
                                    <span className="text-slate-400 text-lg">₹</span>
                                    <span className="text-4xl font-bold text-white">2,000</span>
                                    <span className="text-slate-400">/month</span>
                                </div>
                                <div className="flex items-center justify-center gap-2 mt-2">
                                    <Zap className="w-4 h-4 text-yellow-400" />
                                    <span className="text-sm text-slate-300">Save ₹12,000/year with annual billing</span>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="space-y-3 mb-6">
                                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Everything in Pro:</p>
                                {proFeatures.map((feature) => (
                                    <div key={feature.title} className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                            <feature.icon className="w-4 h-4 text-purple-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">{feature.title}</p>
                                            <p className="text-xs text-slate-400">{feature.description}</p>
                                        </div>
                                        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                    </div>
                                ))}
                            </div>

                            {/* CTA Buttons */}
                            <div className="space-y-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleRequestUpgrade}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 transition-all"
                                >
                                    <Sparkles className="w-5 h-5" />
                                    Request Upgrade
                                    <ArrowRight className="w-5 h-5" />
                                </motion.button>
                                <button
                                    onClick={onClose}
                                    className="w-full px-6 py-3 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                                >
                                    Maybe Later
                                </button>
                            </div>

                            {/* Trust badge */}
                            <p className="text-center text-xs text-slate-500 mt-4">
                                30-day money-back guarantee • Cancel anytime
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
