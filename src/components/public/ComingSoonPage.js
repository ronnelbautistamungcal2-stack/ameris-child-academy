import Link from "next/link";
import PublicLayout from "@/components/public/PublicLayout";
import { ArrowRightIcon, CalendarIcon } from "@/components/public/icons";

export default function ComingSoonPage({
  title,
  description,
  eyebrow,
  message,
}) {
  return (
    <PublicLayout title={title} description={description}>
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div className="section-shell">
          <div className="mx-auto max-w-4xl">
            <div className="glass-surface overflow-hidden rounded-[36px] p-6 sm:p-8 lg:p-10">
              <div className="rounded-[30px] bg-gradient-to-br from-white via-sky-50 to-amber-50 px-6 py-10 text-center shadow-[0_28px_60px_-44px_rgba(15,23,42,0.22)] sm:px-10 lg:px-16 lg:py-16">
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <div className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] bg-slate-900 text-white shadow-[0_20px_40px_-28px_rgba(15,23,42,0.9)]">
                    <CalendarIcon className="h-8 w-8" />
                  </div>
                  <div className="inline-flex min-h-[2.75rem] items-center rounded-full border border-sky-100 bg-white px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.22em] text-sky-700 shadow-sm">
                    {eyebrow || "Page update in progress"}
                  </div>
                </div>
                <h1 className="mt-6 text-4xl font-black tracking-tight text-gray-900 sm:text-5xl">
                  {title}
                </h1>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
                  {message ||
                    "This page is being updated right now. Please check back soon for the full content."}
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-slate-800"
                  >
                    Return Home
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-extrabold text-gray-900 transition hover:bg-gray-50"
                  >
                    Family Portal
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
