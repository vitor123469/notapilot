"use client";

import { useState } from "react";
import { copy } from "../../content/landingCopy";

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  const id = `faq-${index}`;

  return (
    <div className="border-b border-navy-200 last:border-0">
      <button
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left text-navy-900 font-medium hover:text-navy-700 transition-colors"
      >
        <span className="text-base">{q}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 01.708 0L8 10.293l5.646-5.647a.5.5 0 01.708.708l-6 6a.5.5 0 01-.708 0l-6-6a.5.5 0 010-.708z" clipRule="evenodd" />
        </svg>
      </button>
      <div
        id={id}
        role="region"
        hidden={!open}
        className="pb-5 text-navy-600 text-sm leading-relaxed"
      >
        {a}
      </div>
    </div>
  );
}

export function FAQSection() {
  const { faq } = copy;

  return (
    <section id="faq" className="bg-white py-20 sm:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-navy-900">
            {faq.heading}
          </h2>
        </div>

        <div className="divide-y divide-navy-200 border-y border-navy-200 rounded-2xl overflow-hidden">
          {faq.items.map((item, i) => (
            <FAQItem key={item.q} q={item.q} a={item.a} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
