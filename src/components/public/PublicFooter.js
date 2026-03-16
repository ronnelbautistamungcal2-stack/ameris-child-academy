import Link from "next/link";
import { ArrowRightIcon } from "./icons";
import AmerisLogo from "@/components/ui/AmerisLogo";

const QUICK_LINKS = [
  { href: "/programs", label: "Infant Programs" },
  { href: "/resources", label: "Resources" },
  { href: "/careers", label: "Registration Form" },
  { href: "/calendar", label: "Calendar" },
  { href: "/about", label: "About Us" },
];

const CLIENT_PORTALS = [
  { href: "/login", label: "Parents Login" },
  { href: "/login", label: "Teachers Portal" },
  { href: "/login", label: "Admin Dashboard" },
  { href: "/external-clients", label: "External Clients" },
];

export default function PublicFooter() {
  return (
    <footer className="border-t border-white/60 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <AmerisLogo size="sm" showText={false} className="h-10 w-10 rounded-2xl shadow-sm" />
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold text-gray-900">Ameris Academy</div>
                <div className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Childcare</div>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm text-gray-600">
              Providing high-quality care and education for children since 2015. Shaping the leaders of tomorrow, today.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-800">
              Family updates, staff tools, and daily progress in one system
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quick Links</div>
            <ul className="mt-3 space-y-2 text-sm">
              {QUICK_LINKS.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-gray-700 hover:text-sky-700">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Client Portals</div>
            <ul className="mt-3 space-y-2 text-sm">
              {CLIENT_PORTALS.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-gray-700 hover:text-sky-700">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Newsletter</div>
            <div className="mt-2 text-sm text-gray-600">
              Get the latest news and activity updates.
            </div>
            <form
              className="mt-4 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                alert("Newsletter signup not implemented yet");
              }}
            >
              <input
                type="email"
                placeholder="Your email"
                className="w-full rounded-2xl border border-gray-200 bg-white/90 px-4 py-2 text-sm"
              />
              <button
                type="submit"
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm hover:bg-sky-700"
                aria-label="Subscribe"
              >
                <ArrowRightIcon />
              </button>
            </form>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-6 text-xs text-gray-500 sm:flex-row">
          <span>&copy; {new Date().getFullYear()} Ameris Childcare Management. All rights reserved.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-sky-700">Privacy</a>
            <a href="#" className="hover:text-sky-700">Terms of Service</a>
            <a href="#" className="hover:text-sky-700">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
