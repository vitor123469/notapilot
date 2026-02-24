import Link from "next/link";
import { copy } from "../../content/landingCopy";

export function LandingFooter() {
  const { footer } = copy;

  return (
    <footer className="bg-navy-900 border-t border-navy-800 pt-14 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <p className="font-bold text-white text-lg mb-2">{footer.brand}</p>
            <p className="text-navy-400 text-sm leading-relaxed">{footer.tagline}</p>
          </div>

          {/* Link columns */}
          {footer.columns.map((col) => (
            <div key={col.heading}>
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wider mb-4">
                {col.heading}
              </p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-navy-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-navy-800 pt-6">
          <p className="text-xs text-navy-600">{footer.copy}</p>
        </div>
      </div>
    </footer>
  );
}
