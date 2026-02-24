import Link from "next/link";
import { copy } from "../../content/landingCopy";

export function TrustSection() {
  const { trust } = copy;

  return (
    <section id="trust" className="bg-navy-50 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-4">
            {trust.heading}
          </h2>
          <p className="text-navy-500 text-lg">{trust.subheading}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {trust.items.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl p-6 border border-navy-200 flex flex-col gap-3"
            >
              <h3 className="font-semibold text-navy-900 text-base">{item.title}</h3>
              <p className="text-navy-500 text-sm leading-relaxed flex-1">{item.body}</p>
              {"link" in item && item.link && (
                <Link
                  href={item.link.href}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors mt-1"
                >
                  {item.link.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
