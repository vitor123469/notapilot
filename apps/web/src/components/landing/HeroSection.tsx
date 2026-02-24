import Link from "next/link";
import { copy } from "../../content/landingCopy";

export function HeroSection() {
  const { hero } = copy;

  return (
    <section
      id="top"
      className="relative bg-white pt-20 pb-24 sm:pt-28 sm:pb-32 overflow-hidden"
    >
      {/* Subtle background gradient */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,#dcfce7,transparent)]"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
          </span>
          {hero.badge}
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-navy-900 leading-tight tracking-tight mb-6 whitespace-pre-line">
          {hero.headline}
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-navy-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          {hero.subheadline}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <Link
            href={hero.ctaPrimary.href}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-navy-900 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-navy-800 transition-colors text-base shadow-sm"
          >
            {hero.ctaPrimary.label}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M3 8a.5.5 0 01.5-.5h7.793L8.146 4.354a.5.5 0 11.708-.708l4 4a.5.5 0 010 .708l-4 4a.5.5 0 01-.708-.708L11.293 8.5H3.5A.5.5 0 013 8z" clipRule="evenodd" />
            </svg>
          </Link>
          <Link
            href={hero.ctaSecondary.href}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-navy-800 font-semibold px-8 py-3.5 rounded-xl border border-navy-200 hover:border-navy-400 hover:bg-navy-50 transition-colors text-base"
          >
            {hero.ctaSecondary.label}
          </Link>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-navy-400">{hero.disclaimer}</p>

        {/* Mock product screenshot placeholder */}
        <div className="mt-16 mx-auto max-w-3xl rounded-2xl border border-navy-200 shadow-2xl overflow-hidden bg-navy-50">
          <div className="flex items-center gap-1.5 px-4 py-3 bg-navy-900 border-b border-navy-800">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-3 text-xs text-navy-400 font-mono">notapilot — painel</span>
          </div>
          <div className="px-6 py-8 flex flex-col gap-3">
            {/* Simulated WhatsApp messages */}
            <div className="flex justify-end">
              <div className="bg-brand-500 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-xs shadow-sm">
                emitir nota R$ 1.500,00 para Empresa ABC, serviço de consultoria
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-white text-navy-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-xs shadow-sm border border-navy-100">
                ✅ NFS-e <strong>#2847</strong> emitida com sucesso para Empresa ABC.<br />
                <span className="text-navy-500 text-xs">Valor: R$ 1.500,00 · ISS: R$ 75,00</span>
              </div>
            </div>
            <div className="flex justify-end mt-2">
              <div className="bg-brand-500 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-xs shadow-sm">
                status #2847
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-white text-navy-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-xs shadow-sm border border-navy-100">
                📋 Nota <strong>#2847</strong> — <span className="text-brand-600 font-medium">Autorizada</span><br />
                <span className="text-navy-500 text-xs">Emitida 14/02/2026 · PDF disponível</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
