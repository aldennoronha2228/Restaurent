import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export default function NavBar() {
  const [isOpen, setIsOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsOpen(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-b border-border z-50">
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src="/nexresto-logo.svg" alt="NexResto logo" className="h-8 w-8" />
          <span className="font-bold text-xl text-foreground hidden sm:inline">NexResto</span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollToSection("features")}
            className="text-foreground hover:text-accent transition-colors text-sm font-medium"
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection("features")}
            className="text-foreground hover:text-accent transition-colors text-sm font-medium"
          >
            Platform
          </button>
          <button
            onClick={() => scrollToSection("cta")}
            className="text-foreground hover:text-accent transition-colors text-sm font-medium"
          >
            Demo
          </button>
        </div>

        {/* Desktop CTA Buttons */}
        <div className="hidden md:flex md:items-center md:gap-3">
          <Button
            variant="outline"
            className="rounded-full border border-border bg-transparent px-5 text-foreground hover:bg-card"
          >
            Login
          </Button>
          <Button
            onClick={() => scrollToSection("cta")}
            className="rounded-full bg-accent hover:bg-accent/90 text-white font-semibold px-6"
          >
            Get Started
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden text-foreground"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="container py-4 flex flex-col gap-4">
            <button
              onClick={() => scrollToSection("features")}
              className="text-foreground hover:text-accent transition-colors text-sm font-medium text-left"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("features")}
              className="text-foreground hover:text-accent transition-colors text-sm font-medium text-left"
            >
              Platform
            </button>
            <button
              onClick={() => scrollToSection("cta")}
              className="text-foreground hover:text-accent transition-colors text-sm font-medium text-left"
            >
              Demo
            </button>
            <Button
              variant="outline"
              className="border-border bg-transparent text-foreground"
            >
              Login
            </Button>
            <Button
              onClick={() => scrollToSection("cta")}
              className="bg-accent hover:bg-accent/90 text-white font-semibold w-full"
            >
              Get Started
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
