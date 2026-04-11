import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

export default function FinalCTASection() {
  const [formData, setFormData] = useState({ name: "", phone: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);

    try {
      const response = await fetch('/api/demo-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to book demo');
      }

      toast.success("Demo booked! We'll contact you soon.");
      setFormData({ name: "", phone: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to book demo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="cta" className="py-20 px-4 bg-background">
      <div className="container max-w-2xl mx-auto text-center">
        {/* Section Header */}
        <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          See it live.
        </h2>
        <p className="text-lg text-foreground/70 mb-8">
          15 minutes. No commitment. No card. Just a demo at your restaurant.
        </p>

        {/* Demo Form */}
        <div className="bg-card/50 border border-border/50 rounded-xl p-8 md:p-12">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Your name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="bg-background border-border/50 text-foreground placeholder:text-foreground/40 h-12"
              />
            </div>
            <div>
              <Input
                type="tel"
                placeholder="Phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="bg-background border-border/50 text-foreground placeholder:text-foreground/40 h-12"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent/90 text-white font-semibold py-6 text-base rounded-lg"
            >
              {loading ? "Booking..." : "Book Demo"}
            </Button>
          </form>

          <p className="text-xs text-foreground/50 mt-4">
            We respect your privacy. No spam, just a quick call to show you how NexResto works.
          </p>
        </div>

        {/* Trust Indicators */}
        <div className="mt-12 pt-12 border-t border-border/50">
          <p className="text-foreground/60 mb-6">Trusted by 500+ restaurants across India</p>
          <div className="flex justify-center gap-8 flex-wrap">
            <div className="text-center">
              <div className="text-2xl font-bold text-accent mb-1">4.8/5</div>
              <p className="text-sm text-foreground/60">Average Rating</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent mb-1">98%</div>
              <p className="text-sm text-foreground/60">Uptime</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent mb-1">24/7</div>
              <p className="text-sm text-foreground/60">Support</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
