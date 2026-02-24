import Link from "next/link";
import { copy } from "../../content/landingCopy";

export function CTASection() {
  const { ctaFinal } = copy;

  return (
    <section id="cta" className="bg-navy-900 py-20 sm:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          {ctaFinal.heading}
        </h2>
        <p className="text-navy-400 text-lg mb-10 leading-relaxed">
          {ctaFinal.subheading}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
          <Link
            href={ctaFinal.ctaPrimary.href}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-500 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-brand-600 transition-colors text-base shadow-lg shadow-brand-500/20"
          >
            {ctaFinal.ctaPrimary.label}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M3 8a.5.5 0 01.5-.5h7.793L8.146 4.354a.5.5 0 11.708-.708l4 4a.5.5 0 010 .708l-4 4a.5.5 0 01-.708-.708L11.293 8.5H3.5A.5.5 0 013 8z" clipRule="evenodd" />
            </svg>
          </Link>
          <Link
            href={ctaFinal.ctaSecondary.href}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-transparent text-navy-300 font-medium px-8 py-3.5 rounded-xl border border-navy-700 hover:border-navy-500 hover:text-white transition-colors text-base"
          >
            {ctaFinal.ctaSecondary.label}
          </Link>
        </div>

        <p className="text-navy-500 text-xs">{ctaFinal.microcopy}</p>
      </div>
    </section>
  );
}
