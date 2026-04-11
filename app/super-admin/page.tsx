import Link from 'next/link';

export default function SuperAdminHomePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-card/40 p-6">
        <h1 className="text-3xl font-bold">Super Admin</h1>
        <p className="mt-2 text-sm text-foreground/70">Access admin-level tools and incoming leads.</p>
        <div className="mt-6">
          <Link
            href="/super-admin/demo-requests"
            className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Open Demo Requests
          </Link>
        </div>
      </div>
    </main>
  );
}
