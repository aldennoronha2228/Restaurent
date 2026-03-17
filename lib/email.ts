import { Resend } from 'resend';

let resend: Resend | null = null;
const DEV_FALLBACK_FROM = 'NexResto <onboarding@resend.dev>';

function getResendClient() {
    if (!resend) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

function resolveFromEmail(): string | null {
    const raw = (process.env.RESEND_FROM_EMAIL || '').trim();
    if (raw) {
        // Tolerate accidental values like "RESEND_FROM_EMAIL=..." pasted into env value.
        const withoutPrefix = raw.replace(/^RESEND_FROM_EMAIL\s*=\s*/i, '').trim();
        const emailMatch = withoutPrefix.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        if (emailMatch) {
            return `NexResto <${emailMatch[0].toLowerCase()}>`;
        }
        return withoutPrefix;
    }

    // onboarding@resend.dev is sandbox-limited and should not be used in production.
    if (process.env.NODE_ENV === 'production') {
        return null;
    }

    return DEV_FALLBACK_FROM;
}

export async function sendOtpEmail(to: string, otp: string, restaurantName: string): Promise<{ success: boolean; error?: string }> {
    if (!process.env.RESEND_API_KEY) {
        console.error('[EMAIL] RESEND_API_KEY not configured');
        return { success: false, error: 'Email service not configured' };
    }

    const from = resolveFromEmail();
    if (!from) {
        console.error('[EMAIL] RESEND_FROM_EMAIL is required in production');
        return {
            success: false,
            error: 'Email sender not configured. Set RESEND_FROM_EMAIL to a verified domain sender.',
        };
    }

    try {
        const { error } = await getResendClient().emails.send({
            from,
            to: [to],
            subject: `${otp} is your verification code`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                        <h1 style="color: #10b981; font-size: 28px; margin: 0;">NexResto</h1>
                        <p style="color: #64748b; margin: 8px 0 0;">Restaurant Management System</p>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; padding: 32px; text-align: center;">
                        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 16px;">Your verification code for <strong style="color: #f8fafc;">${restaurantName}</strong></p>
                        
                        <div style="background: #0f172a; border: 2px solid #10b981; border-radius: 12px; padding: 24px; margin: 16px 0;">
                            <span style="font-family: 'Monaco', 'Consolas', monospace; font-size: 36px; font-weight: bold; color: #10b981; letter-spacing: 8px;">${otp}</span>
                        </div>
                        
                        <p style="color: #64748b; font-size: 12px; margin: 16px 0 0;">This code expires in 10 minutes</p>
                    </div>
                    
                    <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px;">
                        If you didn't request this code, you can safely ignore this email.
                    </p>
                </div>
            `,
        });

        if (error) {
            console.error('[EMAIL] Resend error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        console.error('[EMAIL] Failed to send:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Failed to send email' };
    }
}

export async function sendPasswordResetLinkEmail(to: string, resetLink: string): Promise<{ success: boolean; error?: string }> {
    if (!process.env.RESEND_API_KEY) {
        console.error('[EMAIL] RESEND_API_KEY not configured');
        return { success: false, error: 'Email service not configured' };
    }

    const from = resolveFromEmail();
    if (!from) {
        console.error('[EMAIL] RESEND_FROM_EMAIL is required in production');
        return {
            success: false,
            error: 'Email sender not configured. Set RESEND_FROM_EMAIL to a verified domain sender.',
        };
    }

    try {
        const { error } = await getResendClient().emails.send({
            from,
            to: [to],
            subject: 'Reset your NexResto password',
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 20px;">
                    <h1 style="color: #0f172a; margin: 0 0 12px;">Reset your password</h1>
                    <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
                        We received a request to reset your NexResto password.
                    </p>
                    <a href="${resetLink}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 600;">
                        Reset Password
                    </a>
                    <p style="color: #64748b; font-size: 12px; margin: 20px 0 0; line-height: 1.6;">
                        If you did not request this, you can safely ignore this email.
                    </p>
                </div>
            `,
        });

        if (error) {
            console.error('[EMAIL] Resend reset-link error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        console.error('[EMAIL] Failed to send reset-link email:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Failed to send email' };
    }
}
