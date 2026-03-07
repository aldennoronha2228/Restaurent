import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SuperAdminAuthProvider } from '@/context/SuperAdminAuthContext';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HotelPro — Dashboard',
  description: 'Hotel restaurant management dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        {/*
          Two independent auth providers — each watches a different Supabase client:
            AuthProvider          → supabase         → hotelpro-tenant-session (sessionStorage)
            SuperAdminAuthProvider → supabaseSuperAdmin → hotelpro-admin-session  (localStorage)
          They are completely isolated: signing out of one never affects the other.
        */}
        <AuthProvider>
          <SuperAdminAuthProvider>
            {children}
          </SuperAdminAuthProvider>
        </AuthProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
