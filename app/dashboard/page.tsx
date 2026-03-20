'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

function DashboardRedirector() {
  const router = useRouter();
  const { tenantId, userRole, mustChangePassword } = useAuth();

  useEffect(() => {
    if (mustChangePassword) {
      router.replace('/change-password');
      return;
    }

    if (userRole === 'super_admin') {
      router.replace('/super-admin');
      return;
    }

    if (tenantId) {
      router.replace(`/${tenantId}/dashboard/tables`);
      return;
    }
  }, [tenantId, userRole, mustChangePassword, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#03050b] text-white">
      <div className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm">Opening dashboard...</div>
    </div>
  );
}

export default function DashboardEntryPage() {
  return (
    <ProtectedRoute>
      <DashboardRedirector />
    </ProtectedRoute>
  );
}
