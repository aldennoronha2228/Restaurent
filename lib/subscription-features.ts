export type CanonicalSubscriptionTier = 'starter' | 'growth' | 'pro_chain';

export type SubscriptionFeature =
    | 'premium_dashboard'
    | 'email_reports'
    | 'advanced_team_roles';

export function normalizeSubscriptionTier(tierRaw: unknown): CanonicalSubscriptionTier {
    const tier = String(tierRaw || '').trim().toLowerCase();

    if (tier === '2.5k' || tier === 'pro_chain') return 'pro_chain';
    if (tier === 'pro' || tier === '2k' || tier === 'growth') return 'growth';
    return 'starter';
}

const FEATURE_MATRIX: Record<CanonicalSubscriptionTier, Record<SubscriptionFeature, boolean>> = {
    starter: {
        premium_dashboard: false,
        email_reports: false,
        advanced_team_roles: false,
    },
    growth: {
        premium_dashboard: true,
        email_reports: true,
        advanced_team_roles: true,
    },
    pro_chain: {
        premium_dashboard: true,
        email_reports: true,
        advanced_team_roles: true,
    },
};

export function hasSubscriptionFeature(tierRaw: unknown, feature: SubscriptionFeature): boolean {
    const tier = normalizeSubscriptionTier(tierRaw);
    return FEATURE_MATRIX[tier][feature];
}

export function isGrowthTierOrAbove(tierRaw: unknown): boolean {
    return hasSubscriptionFeature(tierRaw, 'premium_dashboard');
}
