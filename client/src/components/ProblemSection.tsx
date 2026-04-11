export default function ProblemSection() {
  const problems = [
    { title: "Dead hours", description: "3 PM — cafe is empty. No plan. No offer. Just staring at empty tables." },
    { title: "Order chaos", description: "Captain writes on paper. Wrong item goes. Customer never comes back." },
    { title: "Regulars vanish", description: "New staff. Customer history? Gone. Your best customer feels like a stranger." },
    { title: "Kitchen panic", description: "Rush hour. 12 orders. Nobody knows what to make first. Pure chaos." },
    { title: "Inventory waste", description: "Paneer expires daily. No alerts. Money lost every single day." },
    { title: "Revenue leak", description: "No upsell. Zero combo offers. Revenue opportunity missed at every table." },
  ];

  return (
    <section className="py-20 px-4 bg-background">
      <div className="container max-w-4xl mx-auto">
        {/* Section Title */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Sound familiar?
          </h2>
          <p className="text-lg text-foreground/70">
            Every restaurant owner knows this feeling.
          </p>
        </div>

        {/* Problems Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="p-6 rounded-lg border border-border/50 bg-card/50 hover:bg-card/80 transition-colors"
            >
              <h3 className="text-lg font-bold text-accent mb-2">{problem.title}</h3>
              <p className="text-foreground/70 text-sm leading-relaxed">{problem.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
