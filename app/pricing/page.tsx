import Link from "next/link";

type PricingPlan = {
  name: string;
  subtitle: string;
  priceInr: string;
  priceUsd: string;
  cta: string;
  featured?: boolean;
  detailTitle: string;
  details: string[];
};

type MatrixRow = {
  feature: string;
  starter: boolean;
  growth: boolean;
  pro: boolean;
  enterprise: boolean;
};

const PRICING_PLANS: PricingPlan[] = [
  {
    name: "Starter",
    subtitle: "Up to 15 tables · Go digital",
    priceInr: "Rs 1,799",
    priceUsd: "$21/mo",
    cta: "Start with Starter",
    detailTitle: "Included:",
    details: [
      "QR code per table",
      "Customer PWA - no app download",
      "Kitchen Display (KDS) - real-time",
      "Auto-print thermal receipt",
      "Table map - live floor plan",
      "Menu management + images",
      "Reviews and complaints",
      "GST-compliant receipts",
      "Basic stats + 2 staff roles",
    ],
  },
  {
    name: "Growth",
    subtitle: "Unlimited tables · AI-powered",
    priceInr: "Rs 4,799",
    priceUsd: "$57/mo",
    cta: "Choose Growth",
    featured: true,
    detailTitle: "Everything in Starter, plus:",
    details: [
      "AI mood + menu chat + digest",
      "COD delivery - zero commission",
      "Group ordering - shared cart",
      "Full analytics + dish intelligence",
      "Waitlist + merged tables",
      "Invoice PDF + web push",
      "CSV import + 3 staff roles",
      "Unlimited tables",
    ],
  },
  {
    name: "Pro Chain",
    subtitle: "Up to 5 branches",
    priceInr: "Rs 9,599",
    priceUsd: "$115/mo",
    cta: "Get Pro Chain",
    detailTitle: "Everything in Growth, plus:",
    details: [
      "Multi-branch (up to 5)",
      "White-label customer PWA",
      "Custom domain",
      "Cross-branch analytics",
      "Priority WhatsApp support",
      "Early feature access",
    ],
  },
  {
    name: "Enterprise",
    subtitle: "5+ branches · Full API",
    priceInr: "Custom",
    priceUsd: "",
    cta: "Contact Sales",
    detailTitle: "Everything in Pro, plus:",
    details: [
      "Unlimited branches",
      "Custom API (POS/ERP)",
      "Dedicated infrastructure",
      "99.9% SLA + account manager",
      "Custom development",
    ],
  },
];

const FEATURE_MATRIX: MatrixRow[] = [
  { feature: "QR code ordering (PWA)", starter: true, growth: true, pro: true, enterprise: true },
  { feature: "Customer PWA - no app download", starter: true, growth: true, pro: true, enterprise: true },
  { feature: "Kitchen Display System (KDS)", starter: true, growth: true, pro: true, enterprise: true },
  { feature: "Cafe mode - batch by item", starter: true, growth: true, pro: true, enterprise: true },
  { feature: "Combo deals and offers", starter: true, growth: true, pro: true, enterprise: true },
  { feature: "Menu management + images", starter: true, growth: true, pro: true, enterprise: true },
  { feature: "Reviews and complaints", starter: true, growth: true, pro: true, enterprise: true },
  { feature: "Basic stats", starter: true, growth: true, pro: true, enterprise: true },
  { feature: "AI mood + menu chat", starter: false, growth: true, pro: true, enterprise: true },
  { feature: "Multi-branch analytics", starter: false, growth: false, pro: true, enterprise: true },
  { feature: "Custom API integration", starter: false, growth: false, pro: false, enterprise: true },
];

function FeatureCell({ value }: { value: boolean }) {
  if (!value) {
    return <span className="text-slate-500">-</span>;
  }

  return <span className="font-semibold text-emerald-300">Yes</span>;
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1]">
      <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <img
              alt="NexResto logo mark"
              className="h-9 w-9 rounded-xl border border-white/15 bg-black/30 p-1"
              src="/nexresto-mark.svg?v=20260412d"
            />
            <span className="text-xl font-bold tracking-tight text-white">NexResto</span>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-stone-300 md:flex">
            <Link className="transition-colors hover:text-white" href="/">Home</Link>
            <Link className="transition-colors text-white" href="/pricing">Pricing</Link>
            <Link className="transition-colors hover:text-white" href="/roi">ROI</Link>
            <Link className="transition-colors hover:text-white" href="/#demo-request">Demo</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 sm:px-4 sm:py-2 sm:text-sm"
              href="/login"
            >
              Login
            </Link>
            <Link
              className="rounded-full bg-[#3e54d3] px-4 py-1.5 text-xs font-semibold text-[#d8dbff] transition hover:opacity-90 sm:px-5 sm:py-2 sm:text-sm"
              href="/#demo-request"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main
        className="pt-24 lg:pt-28"
        style={{
          background:
            "radial-gradient(60rem 32rem at 8% 6%, rgba(62, 84, 211, 0.2), transparent 60%), radial-gradient(44rem 28rem at 92% 10%, rgba(16, 185, 129, 0.12), transparent 60%), #131313",
        }}
      >
        <section className="px-6 pb-16 pt-10 lg:px-8 lg:pb-20">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#bbc3ff]">Pricing</p>
            <h1 className="mt-4 text-5xl font-black tracking-tight text-white sm:text-6xl">
              Transparent Pricing. No Surprises.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-xl text-[#c5c5d6]">
              Monthly. Cancel anytime. No annual lock-in. No per-order commission.
            </p>
          </div>
        </section>

        <section className="px-6 pb-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-4">
            {PRICING_PLANS.map((plan) => (
              <article
                className={`relative rounded-2xl border p-8 ${
                  plan.featured ? "border-[#3e54d3]/60 bg-[#171823]" : "border-white/10 bg-[#1b1b1b]"
                }`}
                key={plan.name}
              >
                {plan.featured && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[#3e54d3] px-5 py-1.5 text-sm font-semibold text-[#d8dbff]">
                    Most Popular
                  </div>
                )}

                <h2 className="text-4xl font-black tracking-tight text-white">{plan.name}</h2>
                <p className="mt-2 text-lg text-[#9ca7ba]">{plan.subtitle}</p>

                <p className="mt-7 text-5xl font-black tracking-tight text-white">{plan.priceInr}</p>
                {plan.priceUsd && <p className="mt-2 text-xl text-[#9ca7ba]">{plan.priceUsd}</p>}

                <p className="mt-8 text-lg font-semibold text-emerald-300">{plan.detailTitle}</p>
                <ul className="mt-4 space-y-3 text-lg text-[#c5c5d6]">
                  {plan.details.map((detail) => (
                    <li className="flex items-start gap-3" key={detail}>
                      <span className="mt-0.5 font-bold text-emerald-300">✓</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`mt-9 w-full rounded-full border px-5 py-3 text-lg font-semibold transition ${
                    plan.featured
                      ? "border-[#3e54d3] bg-[#3e54d3] text-[#d8dbff] hover:opacity-90"
                      : "border-white/20 bg-transparent text-white hover:bg-white/10"
                  }`}
                  type="button"
                >
                  {plan.cta}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="px-6 pb-24 lg:px-8">
          <div className="mx-auto max-w-7xl text-center">
            <h2 className="text-5xl font-black tracking-tight text-white">Full Feature Comparison</h2>
            <p className="mt-4 text-2xl text-[#c5c5d6]">Every feature across every plan - see exactly what you get.</p>
          </div>

          <div className="mx-auto mt-10 max-w-7xl overflow-x-auto rounded-2xl border border-white/10 bg-[#1b1b1b]">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="bg-[#20201f]">
                  <th className="px-5 py-4 text-2xl font-bold text-white">Feature</th>
                  <th className="px-5 py-4 text-center text-2xl font-bold text-[#8f8fa0]">Starter</th>
                  <th className="bg-[#212338] px-5 py-4 text-center text-2xl font-bold text-[#bbc3ff]">Growth</th>
                  <th className="px-5 py-4 text-center text-2xl font-bold text-[#8f8fa0]">Pro</th>
                  <th className="px-5 py-4 text-center text-2xl font-bold text-[#8f8fa0]">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_MATRIX.map((row, index) => (
                  <tr className={index % 2 === 0 ? "bg-[#1b1b1b]" : "bg-[#1f1f1f]"} key={row.feature}>
                    <td className="border-t border-white/10 px-5 py-4 text-xl text-[#c5c5d6]">{row.feature}</td>
                    <td className="border-t border-white/10 px-5 py-4 text-center text-lg"><FeatureCell value={row.starter} /></td>
                    <td className="border-t border-white/10 bg-[#1f2234] px-5 py-4 text-center text-lg"><FeatureCell value={row.growth} /></td>
                    <td className="border-t border-white/10 px-5 py-4 text-center text-lg"><FeatureCell value={row.pro} /></td>
                    <td className="border-t border-white/10 px-5 py-4 text-center text-lg"><FeatureCell value={row.enterprise} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-black/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <img
                alt="NexResto logo mark"
                className="h-7 w-7 rounded-md border border-white/15 bg-black/30 p-1"
                src="/nexresto-mark.svg?v=20260412d"
              />
              <p className="text-lg font-bold text-white">NexResto</p>
            </div>
            <p className="mt-3 max-w-sm text-sm text-stone-400">Crafting the digital future of premium dining operations.</p>
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-white">Company</p>
            <div className="space-y-2 text-sm text-stone-400">
              <Link className="block hover:text-emerald-400" href="/">Home</Link>
              <Link className="block hover:text-emerald-400" href="/pricing">Pricing</Link>
              <Link className="block hover:text-emerald-400" href="/roi">ROI</Link>
              <Link className="block hover:text-emerald-400" href="/#demo-request">Demo</Link>
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-white">Legal</p>
            <div className="space-y-2 text-sm text-stone-400">
              <Link className="block hover:text-emerald-400" href="/privacy">Privacy</Link>
              <Link className="block hover:text-emerald-400" href="/terms">Terms</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 pb-10 text-sm text-stone-500 lg:px-8">(c) 2026 NexResto. Premium Dining Experience.</div>
      </footer>

    </div>
  );
}
