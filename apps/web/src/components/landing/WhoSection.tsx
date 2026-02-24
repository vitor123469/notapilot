import Link from "next/link";
import { copy } from "../../content/landingCopy";

export function WhoSection() {
  const { who } = copy;

  return (
    <section id="who" className="bg-white py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-navy-900 leading-tight">
            {who.heading}
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {who.profiles.map((profile, i) => (
            <div
              key={profile.tag}
              className={`rounded-2xl p-8 flex flex-col gap-6 ${
                i === 0
                  ? "bg-navy-900 text-white"
                  : "bg-navy-50 border border-navy-200 text-navy-900"
              }`}
            >
              <div>
                <span
                  className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${
                    i === 0
                      ? "bg-navy-700 text-navy-300"
                      : "bg-brand-100 text-brand-700"
                  }`}
                >
                  {profile.tag}
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3">{profile.title}</h3>
                <p
                  className={`text-sm leading-relaxed ${
                    i === 0 ? "text-navy-400" : "text-navy-600"
                  }`}
                >
                  {profile.body}
                </p>
              </div>
              <div className="mt-auto">
                <Link
                  href={profile.cta.href}
                  className={`inline-flex items-center gap-2 font-medium text-sm px-5 py-2.5 rounded-xl transition-colors ${
                    i === 0
                      ? "bg-white text-navy-900 hover:bg-navy-100"
                      : "bg-navy-900 text-white hover:bg-navy-800"
                  }`}
                >
                  {profile.cta.label}
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M3 8a.5.5 0 01.5-.5h7.793L8.146 4.354a.5.5 0 11.708-.708l4 4a.5.5 0 010 .708l-4 4a.5.5 0 01-.708-.708L11.293 8.5H3.5A.5.5 0 013 8z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
