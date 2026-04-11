import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function PricingSection() {
  const plans = [
    {
      name: "Starter",
      price: "₹999",
      description: "Perfect for small cafes and restaurants",
      features: [
        "QR Code Ordering",
        "Basic Analytics",
        "Up to 50 orders/day",
        "Email Support",
        "Menu Management",
      ],
    },
    {
      name: "Growth",
      price: "₹2,499",
      description: "AI features for growing restaurants",
      features: [
        "Everything in Starter",
        "Daily Pulse (WhatsApp)",
        "Dead Hour Rescue",
        "Customer Memory",
        "Priority Support",
        "Up to 500 orders/day",
      ],
      highlighted: true,
    },
    {
      name: "Pro",
      price: "₹4,999",
      description: "Complete AI-powered management",
      features: [
        "Everything in Growth",
        "Churn Recovery",
        "Advanced Analytics",
        "Inventory Management",
        "Staff Management",
        "Unlimited orders",
        "24/7 Phone Support",
      ],
    },
  ];

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="pricing" className="py-20 px-4 bg-background">
      <div className="container max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Simple. No surprises.
          </h2>
          <p className="text-lg text-foreground/70">
            No setup fees. No commissions. Cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`rounded-xl border transition-all duration-300 ${
                plan.highlighted
                  ? "border-accent bg-card/80 shadow-lg shadow-accent/20 scale-105 md:scale-100"
                  : "border-border/50 bg-card/30 hover:bg-card/50"
              }`}
            >
              {/* Plan Header */}
              <div className="p-8 border-b border-border/50">
                <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                <p className="text-foreground/60 text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-accent">{plan.price}</span>
                  <span className="text-foreground/60">/month</span>
                </div>
              </div>

              {/* Features List */}
              <div className="p-8">
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="text-accent flex-shrink-0 mt-0.5" size={20} />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => scrollToSection("cta")}
                  className={`w-full py-6 font-semibold rounded-lg transition-all ${
                    plan.highlighted
                      ? "bg-accent hover:bg-accent/90 text-white"
                      : "border border-accent/30 text-foreground hover:bg-foreground/5"
                  }`}
                >
                  Get Started
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="text-center p-8 rounded-xl border border-border/50 bg-card/30">
          <p className="text-foreground/70 mb-2">
            All plans include a 14-day free trial. No credit card required.
          </p>
          <p className="text-sm text-foreground/60">
            GST billing support • Offline mode • Real-time sync
          </p>
        </div>
      </div>
    </section>
  );
}
