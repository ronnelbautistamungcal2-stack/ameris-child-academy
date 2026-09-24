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
          apiJson("/api/v1/policies"),
          apiJson("/api/v1/parent-faqs"),
        ]);
        setDocs(Array.isArray(policyResult) ? policyResult : []);
        setFaqs(Array.isArray(faqResult) ? faqResult : []);
      } catch (e) {
        setError(e.message || "Failed to load policies");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredDocs = useMemo(() => {
    // Most recently updated first, the way the center reads its own shelf.
    const sorted = [...docs].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0) -
          new Date(a.updatedAt || a.createdAt || 0) ||
        String(a.title || "").localeCompare(String(b.title || "")),
    );
    const q = docQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((doc) =>
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

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {loading ? (
            <div className="p-4">
              <Skeleton count={5} />
            </div>
          ) : filteredDocs.length ? (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredDocs.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
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

function DocumentRow({ doc }) {
  const isPdf = /\.pdf($|\?)/i.test(String(doc.url || ""));

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="shrink-0">{isPdf ? <PdfIcon /> : <FileIcon />}</span>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-bold ${NAVY}`}>{doc.title}</div>
        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Updated {formatUpdated(doc.updatedAt || doc.createdAt)}
        </div>
      </div>
      <a
        href={doc.url}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 rounded-lg border border-sky-200 bg-white px-5 py-1.5 text-xs font-bold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 dark:border-sky-800 dark:bg-transparent dark:text-sky-300 dark:hover:bg-sky-950/40"
      >
        View
      </a>
    </li>
  );
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

function PdfIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
      <path
        fill="#DC2626"
        d="M7 2.5h11.5L26 10v19a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 6 29V4a1.5 1.5 0 0 1 1-1.5Z"
      />
      <path fill="#FCA5A5" d="M18.5 2.5 26 10h-6a1.5 1.5 0 0 1-1.5-1.5Z" />
      <text
        x="16"
        y="24"
        textAnchor="middle"
        fill="#fff"
        fontSize="8"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        PDF
      </text>
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1c5fa8"
      strokeWidth={1.8}
      className="h-8 w-8"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v4.5h4.5" />
    </svg>
  );
}

function formatUpdated(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${date.getFullYear()}`;
}
