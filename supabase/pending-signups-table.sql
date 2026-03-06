-- ============================================================
-- Create Pending Signups Table for OTP Verification
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pending_signups (
    email TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    restaurant_name TEXT NOT NULL,
    master_pin TEXT NOT NULL,
    otp TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow service role full access (no RLS needed - server-side only)
ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

-- Auto-delete expired entries (run periodically or via cron)
-- DELETE FROM public.pending_signups WHERE expires_at < NOW();

COMMENT ON TABLE public.pending_signups IS 'Temporary storage for signup OTP verification. Entries expire after 10 minutes.';
