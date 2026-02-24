import { copy } from "../../content/landingCopy";

export function HowSection() {
  const { how } = copy;

  return (
    <section id="how" className="bg-white py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-4">
            {how.heading}
          </h2>
          <p className="text-navy-500 text-lg">{how.subheading}</p>
        </div>

        <div className="relative grid sm:grid-cols-3 gap-8">
          {/* Connector line (desktop only) */}
          <div
            aria-hidden="true"
            className="hidden sm:block absolute top-8 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-navy-200"
          />

          {how.steps.map((step) => (
            <div key={step.number} className="flex flex-col items-center text-center gap-4">
              <div className="relative z-10 w-16 h-16 rounded-2xl bg-navy-900 text-white flex items-center justify-center font-bold text-xl shadow-md">
                {step.number}
              </div>
              <div>
                <h3 className="font-semibold text-navy-900 text-lg mb-2">{step.title}</h3>
                <p className="text-navy-500 text-sm leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
