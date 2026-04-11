import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQSection() {
  const faqs = [
    {
      question: "Do my customers need to download an app?",
      answer:
        "No. NexResto works as a Progressive Web App that opens in any smartphone browser. Customers scan the QR code and the menu loads instantly — no app store, no download, no friction. Works on any Android or iPhone.",
    },
    {
      question: "How long does it take to set up?",
      answer:
        "Most restaurants go live in under 5 minutes. Add your menu, print QR codes, and you're ready. No technician visits, no hardware needed. Just a phone or tablet for the kitchen display.",
    },
    {
      question: "How much does restaurant management software cost?",
      answer:
        "NexResto plans start at ₹999/month for cafes and small restaurants. Growth plan at ₹2,499/month adds AI features like daily pulse and customer memory. No setup fees, no per-order commissions, no annual lock-in. Cancel anytime.",
    },
    {
      question: "What is the Daily Pulse feature?",
      answer:
        "Every morning at 6 AM, restaurant owners get a WhatsApp message with 3 lines: yesterday's revenue, the best-selling item, and one actionable alert. No app to open, no dashboard to check. It's like having a manager who never sleeps.",
    },
    {
      question: "How does QR code ordering work?",
      answer:
        "Each table gets a unique QR code. Customers scan it with their phone camera, the digital menu opens in their browser instantly (no app download), they browse, customize, and place their order. The kitchen gets it on the Kitchen Display System in real-time. No waiter needed for order-taking.",
    },
    {
      question: "What is a Kitchen Display System (KDS)?",
      answer:
        "A KDS replaces paper KOT slips in the kitchen. Orders appear on a screen in real-time with smart sequencing — the AI prioritizes what to cook first based on prep time and order urgency. No shouting, no lost orders, no confusion during rush hour.",
    },
    {
      question: "Can I use this with my existing POS?",
      answer:
        "NexResto is a complete platform — QR ordering, kitchen display, analytics, inventory, and AI brain. It replaces your existing billing software and POS, not adds on top of them. Most owners switch completely within a day.",
    },
    {
      question: "Does it work without internet?",
      answer:
        "The Kitchen Display continues showing existing orders during brief outages and syncs automatically when connectivity returns. For QR ordering, customers need internet on their phones, but WiFi at the restaurant is enough.",
    },
    {
      question: "How can I reduce wrong orders?",
      answer:
        "With QR ordering, customers place orders directly from their phone — no miscommunication between waiter and kitchen. The order goes straight to the Kitchen Display System digitally. Restaurants using NexResto report near-zero wrong orders compared to paper KOT systems.",
    },
    {
      question: "How do I increase revenue during dead hours?",
      answer:
        "NexResto's AI brain detects dead hours automatically (e.g., 3 PM when the cafe is empty). It generates a targeted offer and sends it via WhatsApp to nearby customers — all without you doing anything. Restaurant owners see 15-30% more footfall during previously dead hours.",
    },
    {
      question: "Does NexResto support GST billing?",
      answer:
        "Yes. All invoices are GST-compliant with proper GSTIN, HSN codes, and tax breakdowns. PDF invoices can be emailed to customers automatically.",
    },
  ];

  return (
    <section id="faq" className="py-20 px-4 bg-card/30">
      <div className="container max-w-3xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Questions?
          </h2>
          <p className="text-lg text-foreground/70">
            Find answers to common questions about NexResto.
          </p>
        </div>

        {/* FAQ Accordion */}
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="border-b border-border/50"
            >
              <AccordionTrigger className="py-4 hover:text-accent transition-colors text-left">
                <span className="font-semibold text-foreground">{faq.question}</span>
              </AccordionTrigger>
              <AccordionContent className="text-foreground/70 pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
