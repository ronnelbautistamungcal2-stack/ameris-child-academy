import DocumentsPage from "@/components/documents/DocumentsPage";
import ParentLayout from "@/components/parent/ParentLayout";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const NAVY = "text-[#12386a] dark:text-slate-100";

export default function ParentPolicies() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [faqQuery, setFaqQuery] = useState("");
  const [openFaqId, setOpenFaqId] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const faqResult = await apiJson("/api/v1/parent-faqs");
        setFaqs(Array.isArray(faqResult) ? faqResult : []);
      } catch (e) {
        setError(e.message || "Failed to load policies");
      } finally {
        setLoading(false);
      }
    })();
  }, []);


  const filteredFaqs = useMemo(() => {
    const q = faqQuery.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter((faq) =>
      `${faq.question || ""} ${faq.answer || ""}`.toLowerCase().includes(q),
    );
  }, [faqs, faqQuery]);

  return (
    <ParentLayout title="Policies and Procedures">
      <div className="space-y-5">
        {/* Opens a policy on the right, like Additional Resources (client request 2026-10-29). */}
        <DocumentsPage category="POLICY" />

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className={`text-xl font-black tracking-tight sm:text-2xl ${NAVY}`}>
              Common Parent Questions
            </h2>
            <SearchBox
              value={faqQuery}
              onChange={setFaqQuery}
              placeholder="Search questions..."
              label="Search common parent questions"
            />
          </div>

          <div className="mt-4">
            {loading ? (
              <Skeleton count={4} />
            ) : filteredFaqs.length ? (
              <div className="space-y-2">
                {filteredFaqs.map((faq) => (
                  <FaqRow
                    key={faq.id}
                    faq={faq}
                    open={openFaqId === faq.id}
                    onToggle={() =>
                      setOpenFaqId(openFaqId === faq.id ? null : faq.id)
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {faqQuery
                  ? "No questions match your search."
                  : "No questions have been posted yet."}
              </p>
            )}
          </div>
        </section>
      </div>
    </ParentLayout>
  );
}


// Red Acrobat-style document mark, matching the mockup's policy list.


function FaqRow({ faq, open, onToggle }) {
  return (
    <div
      className={[
        "overflow-hidden rounded-xl border transition-colors",
        open
          ? "border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30"
          : "border-transparent bg-[#f1f6fb] hover:bg-[#e8f1fa] dark:bg-slate-900/50 dark:hover:bg-slate-900",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className={`text-sm font-bold ${NAVY}`}>{faq.question}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          className={`h-4 w-4 shrink-0 text-[#1c5fa8] transition-transform dark:text-sky-300 ${open ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 9 7 7 7-7" />
        </svg>
      </button>
      {open ? (
        <div className="whitespace-pre-wrap px-4 pb-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
          {faq.answer}
        </div>
      ) : null}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder, label }) {
  return (
    <div className="relative w-full sm:w-72">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
      >
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-700 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-sky-900/40"
      />
    </div>
  );
}

// Oldest first, so the list follows the order the center added documents in.
