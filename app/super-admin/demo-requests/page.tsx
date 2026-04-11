'use client';

import { useEffect, useMemo, useState } from 'react';

type DemoSubmission = {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function SuperAdminDemoRequestsPage() {
  const [items, setItems] = useState<DemoSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => items.length, [items]);

  const load = async () => {
    try {
      setError(null);
      const res = await fetch('/api/demo-requests', { cache: 'no-store' });
      const payload = (await res.json().catch(() => ({}))) as { submissions?: DemoSubmission[]; error?: string };
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to load demo requests');
      }
      setItems(Array.isArray(payload.submissions) ? payload.submissions : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demo requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Super Admin Demo Requests</h1>
            <p className="mt-1 text-sm text-foreground/60">Live requests from the home page demo form.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-md border border-border bg-card px-3 py-2 text-sm">Total: {total}</span>
            <button
              type="button"
              onClick={load}
              className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-border bg-card/40">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-card/80 text-foreground/80">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Requested At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-foreground/60">
                    Loading requests...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-foreground/60">
                    No demo requests yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-border/60">
                    <td className="px-4 py-3">{item.name}</td>
                    <td className="px-4 py-3">{item.phone}</td>
                    <td className="px-4 py-3 text-foreground/70">{formatDate(item.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
