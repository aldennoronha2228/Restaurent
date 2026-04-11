import { Brain, TrendingUp, Users, RotateCcw } from "lucide-react";

export default function FeaturesSection() {
  const features = [
    {
      number: "01",
      title: "Daily Pulse",
      subtitle: "Your morning briefing.",
      description: "3 lines on WhatsApp at 6 AM. Revenue, best seller, one alert. Every morning, before you even open the shutter.",
      icon: TrendingUp,
    },
    {
      number: "02",
      title: "Dead Hour Rescue",
      subtitle: "Empty cafe? Not anymore.",
      description: "Brain detects dead hours. Auto-generates an offer. Sends WhatsApp to your customers. You do nothing. They walk in.",
      icon: Brain,
    },
    {
      number: "03",
      title: "Customer Memory",
      subtitle: "Staff changes. Memory doesn't.",
      description: "Every regular's favourite dish, last visit, allergies — remembered forever. Not in the waiter's head. In the brain.",
      icon: Users,
    },
    {
      number: "04",
      title: "Churn Recovery",
      subtitle: "Your regular stopped coming.",
      description: "Brain detects the pattern. Win-back message sent automatically. You didn't even notice they were gone.",
      icon: RotateCcw,
    },
  ];

  return (
    <section id="features" className="py-20 px-4 bg-card/30">
      <div className="container max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-accent text-sm font-semibold uppercase tracking-wider">Meet the Brain</span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mt-4 mb-4">
            It detects. It decides. It acts.
          </h2>
          <p className="text-lg text-foreground/70">
            AI-powered features that work while you sleep.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="p-8 rounded-xl border border-border/50 bg-background hover:border-accent/30 transition-all duration-300"
              >
                {/* Feature Number and Icon */}
                <div className="flex items-start justify-between mb-6">
                  <span className="text-5xl font-bold text-accent/20">{feature.number}</span>
                  <Icon className="text-accent" size={28} />
                </div>

                {/* Feature Title and Subtitle */}
                <h3 className="text-2xl font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-accent font-semibold text-sm mb-4">{feature.subtitle}</p>

                {/* Feature Description */}
                <p className="text-foreground/70 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>

        {/* QR Ordering Section */}
        <div className="mt-20 pt-20 border-t border-border/50">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Scan. Order. Done.
            </h2>
            <p className="text-lg text-foreground/70">
              No app. No waiter. Customer scans QR, orders from their phone. Kitchen gets it instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-accent">1</span>
              </div>
              <h4 className="text-lg font-bold text-foreground mb-2">Scan QR</h4>
              <p className="text-foreground/70">Customer scans the unique table QR code</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-accent">2</span>
              </div>
              <h4 className="text-lg font-bold text-foreground mb-2">Browse & Order</h4>
              <p className="text-foreground/70">Menu opens instantly, no app download needed</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-accent">3</span>
              </div>
              <h4 className="text-lg font-bold text-foreground mb-2">Kitchen Ready</h4>
              <p className="text-foreground/70">Order appears on kitchen display instantly</p>
            </div>
          </div>
        </div>

        {/* KDS Section */}
        <div className="mt-20 pt-20 border-t border-border/50">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Kitchen knows what's first.
            </h2>
            <p className="text-lg text-foreground/70">
              Smart sequencing. AI priority. No shouting. Every dish in the right order, at the right time.
            </p>
          </div>

          <div className="p-8 rounded-xl border border-border/50 bg-background">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-bold text-foreground mb-4">Kitchen Display System (KDS)</h4>
                <ul className="space-y-3">
                  <li className="flex gap-3">
                    <span className="text-accent font-bold">✓</span>
                    <span className="text-foreground/70">Real-time order updates on display</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-accent font-bold">✓</span>
                    <span className="text-foreground/70">AI-powered priority sequencing</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-accent font-bold">✓</span>
                    <span className="text-foreground/70">Eliminates paper KOT slips</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-accent font-bold">✓</span>
                    <span className="text-foreground/70">Reduces order errors by 95%</span>
                  </li>
                </ul>
              </div>
              <div className="bg-card/50 rounded-lg p-6 border border-border/30">
                <p className="text-sm text-foreground/60 mb-4">Example KDS Display</p>
                <div className="space-y-2">
                  <div className="bg-accent/20 border-l-4 border-accent p-3 rounded">
                    <p className="text-sm font-semibold text-foreground">ORD-0001 (Table 5)</p>
                    <p className="text-xs text-foreground/60">Paneer Tikka, Biryani | 8 min</p>
                  </div>
                  <div className="bg-card border-l-4 border-foreground/20 p-3 rounded">
                    <p className="text-sm font-semibold text-foreground">ORD-0002 (Table 3)</p>
                    <p className="text-xs text-foreground/60">Butter Chicken, Naan | 12 min</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
