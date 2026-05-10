const isProd = process.env.NODE_ENV === 'production';
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
const vercelOrigin = vercelUrl ? `https://${vercelUrl.replace(/^https?:\/\//, '')}` : '';
const prodFallbackOrigin = 'https://nexresto.in';

const appUrl = process.env.NEXT_PUBLIC_APP_URL
  || (isProd ? (vercelOrigin || prodFallbackOrigin) : 'http://localhost:3000');

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || process.env.NEXT_PUBLIC_APP_URL
  || (isProd ? (vercelOrigin || prodFallbackOrigin) : 'http://localhost:3000');

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl,
  siteUrl,
  aiControlEnabled: String(process.env.AI_CONTROL_ENABLED || 'true').toLowerCase() === 'true',
};
