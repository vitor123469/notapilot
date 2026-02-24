import { copy } from "../../content/landingCopy";

export function FeaturesSection() {
  const { features } = copy;

  return (
    <section id="features" className="bg-navy-900 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {features.heading}
          </h2>
          <p className="text-navy-400 text-lg">{features.subheading}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.items.map((item) => (
            <div
              key={item.title}
              className="bg-navy-800 rounded-2xl p-5 border border-navy-700 hover:border-navy-600 transition-colors"
            >
              <span className="text-2xl mb-3 block" aria-hidden="true">{item.icon}</span>
              <h3 className="font-semibold text-white text-sm mb-2">{item.title}</h3>
              <p className="text-navy-400 text-xs leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
