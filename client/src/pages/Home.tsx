import { useEffect } from "react";
import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import ProblemSection from "@/components/ProblemSection";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import FAQSection from "@/components/FAQSection";
import FinalCTASection from "@/components/FinalCTASection";
import FooterSection from "@/components/FooterSection";

export default function Home() {
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (prefersReduced) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main className="pt-16">
        <div className="reveal-on-scroll" data-reveal>
          <HeroSection />
        </div>
        <div className="reveal-on-scroll" data-reveal>
          <ProblemSection />
        </div>
        <div className="reveal-on-scroll" data-reveal>
          <FeaturesSection />
        </div>
        <div className="reveal-on-scroll" data-reveal>
          <PricingSection />
        </div>
        <div className="reveal-on-scroll" data-reveal>
          <FAQSection />
        </div>
        <div className="reveal-on-scroll" data-reveal>
          <FinalCTASection />
        </div>
      </main>
      <div className="reveal-on-scroll" data-reveal>
        <FooterSection />
      </div>
    </div>
  );
}
