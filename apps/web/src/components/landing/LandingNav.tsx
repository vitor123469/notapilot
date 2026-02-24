"use client";

import Link from "next/link";
import { useState } from "react";
import { copy } from "../../content/landingCopy";

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const { nav } = copy;

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-navy-200">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link
          href="#top"
          className="flex items-center gap-2 font-semibold text-navy-900 text-lg"
        >
          {nav.brand}
          <span className="text-xs font-medium bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
            {nav.badge}
          </span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-6">
          {nav.links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="text-sm text-navy-600 hover:text-navy-900 transition-colors"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/auth/signup"
            className="text-sm font-medium bg-navy-900 text-white px-4 py-2 rounded-lg hover:bg-navy-800 transition-colors"
          >
            Criar conta
          </Link>
          <Link
            href={nav.cta.href}
            className="text-sm font-medium text-navy-700 hover:text-navy-900 transition-colors"
          >
            {nav.cta.label}
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 rounded-md text-navy-700 hover:bg-navy-100 transition-colors"
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-navy-200 bg-white px-4 pb-4">
          <ul className="flex flex-col gap-1 pt-2">
            {nav.links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-2 text-sm text-navy-600 hover:text-navy-900 transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-navy-100">
            <Link
              href="/auth/signup"
              onClick={() => setOpen(false)}
              className="text-center text-sm font-medium bg-navy-900 text-white px-4 py-2.5 rounded-lg hover:bg-navy-800 transition-colors"
            >
              Criar conta
            </Link>
            <Link
              href="/auth/login"
              onClick={() => setOpen(false)}
              className="text-center text-sm font-medium text-navy-700 hover:text-navy-900 py-2 transition-colors"
            >
              Entrar
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
