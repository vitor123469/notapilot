import { copy } from "../../content/landingCopy";

export function WhySection() {
  const { why } = copy;

  return (
    <section id="why" className="bg-navy-50 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-navy-900 leading-tight mb-4">
            {why.heading}
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {why.cards.map((card) => (
            <div
              key={card.title}
              className="bg-white rounded-2xl p-6 border border-navy-200 flex flex-col gap-4"
            >
              <span className="text-3xl" aria-hidden="true">{card.icon}</span>
              <div>
                <h3 className="font-semibold text-navy-900 text-lg mb-2">{card.title}</h3>
                <p className="text-navy-600 text-sm leading-relaxed">{card.body}</p>
              </div>
              <div className="mt-auto pt-4 border-t border-navy-100">
                <p className="text-sm text-brand-700 font-medium">{card.promise}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
