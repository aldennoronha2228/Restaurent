import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function HeroSection() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="pt-32 pb-20 px-4 bg-background relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
      
      <div className="container max-w-4xl mx-auto text-center relative z-10">
        {/* Powered by badge */}
        <div className="inline-block mb-6">
          <span className="text-accent text-sm font-semibold border border-accent/30 rounded-full px-4 py-1.5">
            Powered by AI
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
          Your Restaurant.
          <br />
          <span className="text-accent">Now Has a Brain.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-foreground/80 mb-8 max-w-2xl mx-auto leading-relaxed">
          One QR. Zero app downloads. It thinks, so you don't have to.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Button
            onClick={() => scrollToSection("cta")}
            className="bg-accent hover:bg-accent/90 text-white font-semibold px-8 py-6 text-base rounded-lg"
          >
            Book a 15-min Demo
          </Button>
          <Button
            onClick={() => scrollToSection("features")}
            variant="outline"
            className="border-accent/30 text-foreground hover:bg-foreground/5 font-semibold px-8 py-6 text-base rounded-lg flex items-center justify-center gap-2"
          >
            See How It Works
            <ArrowRight size={18} />
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4 md:gap-8 pt-8 border-t border-border/50">
          <div>
            <div className="text-3xl md:text-4xl font-bold text-accent mb-2">5 min</div>
            <p className="text-sm text-foreground/60">to go live</p>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold text-accent mb-2">0</div>
            <p className="text-sm text-foreground/60">app downloads</p>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold text-accent mb-2">30%</div>
            <p className="text-sm text-foreground/60">higher AOV</p>
          </div>
        </div>
      </div>
    </section>
  );
}
