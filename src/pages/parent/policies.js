import ParentLayout from "@/components/parent/ParentLayout";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const NAVY = "text-[#12386a] dark:text-slate-100";

export default function ParentPolicies() {
  const [docs, setDocs] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [docQuery, setDocQuery] = useState("");
  const [faqQuery, setFaqQuery] = useState("");
  const [openFaqId, setOpenFaqId] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [policyResult, faqResult] = await Promise.all([
          apiJson("/api/v1/policies?category=POLICY"),
          apiJson("/api/v1/parent-faqs"),
        ]);
        setDocs(sortByCreated(Array.isArray(policyResult) ? policyResult : []));
        setFaqs(Array.isArray(faqResult) ? faqResult : []);
      } catch (e) {
        setError(e.message || "Failed to load policies");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredDocs = useMemo(() => {
    const q = docQuery.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) =>
      `${doc.title || ""} ${doc.description || ""}`.toLowerCase().includes(q),
    );
  }, [docs, docQuery]);

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className={`text-2xl font-black tracking-tight sm:text-3xl ${NAVY}`}>
            Policies and Procedures
          </h1>
          <SearchBox
            value={docQuery}
            onChange={setDocQuery}
            placeholder="Search documents..."
            label="Search policy documents"
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/25 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white px-3 py-1 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:px-4">
          {loading ? (
            <div className="py-3">
              <Skeleton count={6} />
            </div>
          ) : filteredDocs.length ? (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredDocs.map((doc) => (
                <DocRow key={doc.id} doc={doc} />
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {docQuery
                ? "No documents match your search."
                : "No policy documents have been published yet."}
            </p>
          )}
        </section>

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

function DocRow({ doc }) {
  return (
    <li className="flex items-center gap-3 py-2.5 sm:gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-900">
        <PdfIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-bold ${NAVY}`}>{doc.title}</p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Updated {formatShortDate(doc.updatedAt || doc.createdAt)}
        </p>
      </div>
      <a
        href={doc.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`View ${doc.title}`}
        className="shrink-0 rounded-lg border-2 border-[#1c7ed6] bg-white px-6 py-1.5 text-sm font-bold text-[#1c5fa8] transition hover:bg-sky-50 dark:border-sky-500 dark:bg-transparent dark:text-sky-300 dark:hover:bg-sky-950/40 sm:px-9"
      >
        View
      </a>
    </li>
  );
}

// Red Acrobat-style document mark, matching the mockup's policy list.
function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        fill="#E11D24"
        d="M5.5 1.5h9l5 5v15a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-19a1 1 0 0 1 1-1Z"
      />
      <path fill="#F87171" d="M14.5 1.5 19.5 6.5h-4a1 1 0 0 1-1-1Z" />
      <path
        fill="none"
        stroke="#fff"
        strokeWidth={1.3}
        strokeLinejoin="round"
        d="M11.2 8.2c-.9 0-.6 2.2.9 4.8 1.3 2.3 2.9 3.9 3.9 3.5.9-.4-.5-1.6-3.2-1.3-2.9.3-5.4 1.6-5.2 2.4.2.9 1.8-.3 3-2.8 1.1-2.4 1.5-6.6.6-6.6Z"
      />
    </svg>
  );
}

function formatShortDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

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
function sortByCreated(docs) {
  return [...docs].sort(
    (a, b) =>
      new Date(a.createdAt || 0) - new Date(b.createdAt || 0) ||
      String(a.title || "").localeCompare(String(b.title || "")),
  );
}
