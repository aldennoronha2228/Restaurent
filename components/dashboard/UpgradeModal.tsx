'use client';

/**
 * Premium Upgrade Modal
 * High-converting modal shown to Starter tier users when they try to access Pro features
 */

import { motion, AnimatePresence } from 'motion/react';
import { 
    X, Check, Crown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { PRICING_PLANS } from '@/lib/pricing';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    featureName?: string;
}

function normalizePriceInr(priceInr: string): string {
    return String(priceInr || '').replace(/^Rs\s*/i, '₹');
}

export function UpgradeModal({ isOpen, onClose, featureName }: UpgradeModalProps) {
    const defaultPlanName = PRICING_PLANS.find((plan) => plan.featured)?.name || PRICING_PLANS[0]?.name || 'Starter';
    const [selectedPlanName, setSelectedPlanName] = useState(defaultPlanName);
    const selectedPlan = PRICING_PLANS.find((plan) => plan.name === selectedPlanName) || PRICING_PLANS[0];

    const handleRequestUpgrade = () => {
        // In production, this would send an email notification to super admin
        // or redirect to a payment page
        const plan = selectedPlan?.name || 'Selected plan';
        alert(`${plan} upgrade request sent! Our team will contact you shortly.`);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-2 sm:p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.98, y: 10 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.98, y: 10 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative bg-white rounded-2xl border border-slate-200 w-full max-w-lg overflow-hidden shadow-xl"
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors z-10"
                        >
                            <X className="w-4 h-4 text-slate-500" />
                        </button>

                        <div className="relative p-5">
                            {/* Header */}
                            <div className="text-center mb-5">
                                <Crown className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                                <h2 className="font-semibold text-slate-900 text-xl mb-1">Choose your subscription plan</h2>
                                <p className="text-slate-500 text-sm">
                                    {featureName ? `Unlock ${featureName} and more with a higher plan.` : 'Upgrade to access more features.'}
                                </p>
                            </div>

                            {/* Tier comparison */}
                            <div className="flex flex-col gap-3 mb-4">
                                {PRICING_PLANS.map((plan) => {
                                    const isSelected = selectedPlanName === plan.name;
                                    return (
                                        <button
                                            key={plan.name}
                                            onClick={() => setSelectedPlanName(plan.name)}
                                            className={cn(
                                                'w-full rounded-xl border p-4 text-left transition-all relative bg-slate-50',
                                                isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 hover:border-blue-300'
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                                                <span className="text-lg font-bold text-slate-900">{normalizePriceInr(plan.priceInr)}<span className="text-xs font-medium text-slate-500">/mo</span></span>
                                            </div>
                                            {plan.featured && (
                                                <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold tracking-wide">POPULAR</span>
                                            )}
                                            <ul className="text-xs text-slate-700 mt-1 space-y-0.5">
                                                {plan.details.slice(0, 6).map((feature) => (
                                                    <li key={feature} className="flex items-center gap-2">
                                                        <Check className="w-3.5 h-3.5 text-blue-400" />
                                                        <span>{feature}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* CTA Buttons */}
                            <div className="space-y-2">
                                <motion.button
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={handleRequestUpgrade}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold rounded-xl transition-all"
                                >
                                    {selectedPlan ? `Subscribe to ${selectedPlan.name} (${normalizePriceInr(selectedPlan.priceInr)})` : 'Continue'}
                                </motion.button>
                                <button
                                    onClick={onClose}
                                    className="w-full px-6 py-1 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
                                >
                                    Maybe Later
                                </button>
                            </div>

                            <p className="text-center text-[11px] text-slate-400 mt-2">
                                Monthly subscription renews automatically.
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
