import Skeleton from "@/components/ui/Skeleton";
import { useEffect, useMemo, useRef, useState } from "react";

const NAVY = "text-[#12386a] dark:text-slate-100";

// Resource icons cycle through these so a long list reads as distinct items,
// the way the mockup colour-codes each resource.
const ICON_TINTS = [
  "text-sky-600 dark:text-sky-300",
  "text-emerald-600 dark:text-emerald-300",
  "text-teal-600 dark:text-teal-300",
  "text-rose-500 dark:text-rose-300",
  "text-orange-500 dark:text-orange-300",
  "text-violet-600 dark:text-violet-300",
  "text-amber-500 dark:text-amber-300",
  "text-indigo-600 dark:text-indigo-300",
];

/**
 * Two-pane document browser: a searchable list on the left and the selected
 * document rendered inline on the right, with a Print button. Used by the
 * parent Policies and Additional Resources pages.
 */
export default function DocumentLibrary({
  docs,
  loading,
  listTitle,
  searchPlaceholder,
  emptyText,
  iconVariant = "pdf",
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const viewerRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) =>
      `${doc.title || ""} ${doc.description || ""}`.toLowerCase().includes(q),
    );
  }, [docs, query]);

  // Keep a document open: default to the first one on load, and recover if
  // the selected one disappears. Searching the list leaves the viewer alone.
  useEffect(() => {
    if (!docs.length) {
      setSelectedId(null);
    } else if (!docs.some((doc) => doc.id === selectedId)) {
      setSelectedId(docs[0].id);
    }
  }, [docs, selectedId]);

  const selected = docs.find((doc) => doc.id === selectedId) || null;

  function selectDoc(id) {
    setSelectedId(id);
    // On narrow screens the viewer sits below the list; bring it into view.
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <section className="grid grid-cols-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:grid-cols-[minmax(260px,320px)_1fr]">
      <div className="border-b border-gray-200 p-4 dark:border-gray-700 lg:border-b-0 lg:border-r">
        <h2 className={`text-base font-black ${NAVY}`}>{listTitle}</h2>
        <div className="mt-3">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder={searchPlaceholder}
            label={searchPlaceholder}
          />
        </div>

        <div className="mt-3">
          {loading ? (
            <Skeleton count={6} />
          ) : filtered.length ? (
            <ul className="space-y-0.5 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1">
              {filtered.map((doc, index) => {
                const active = doc.id === selectedId;
                return (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => selectDoc(doc.id)}
                      aria-current={active ? "true" : undefined}
                      className={[
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                        active
                          ? "bg-sky-100 dark:bg-sky-950/50"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                      ].join(" ")}
                    >
                      <span className="shrink-0">
                        {iconVariant === "pdf" ? (
                          <PdfIcon />
                        ) : (
                          <DocIcon className={ICON_TINTS[index % ICON_TINTS.length]} />
                        )}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${active ? "font-bold" : "font-semibold"} ${NAVY}`}
                      >
                        {doc.title}
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-gray-400"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {query ? "No documents match your search." : emptyText}
            </p>
          )}
        </div>
      </div>

      <div ref={viewerRef} className="min-w-0 scroll-mt-4 p-4 sm:p-5">
        {loading ? (
          <Skeleton count={8} />
        ) : selected ? (
          <DocumentViewer doc={selected} />
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            {emptyText}
          </div>
        )}
      </div>
    </section>
  );
}

function DocumentViewer({ doc }) {
  const frameRef = useRef(null);
  const kind = fileKind(doc.url);

  function handlePrint() {
    // Uploads are same-origin, so the embedded viewer can print directly.
    // If the browser refuses (cross-origin link, no PDF plugin), fall back to
    // opening the file in a new tab where the browser's own print is one click.
    try {
      const win = frameRef.current?.contentWindow;
      if (!win) throw new Error("no frame");
      win.focus();
      win.print();
    } catch {
      window.open(doc.url, "_blank", "noopener");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className={`text-lg font-black ${NAVY}`}>{doc.title}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Last Updated: {formatLongDate(doc.updatedAt || doc.createdAt)}
            {doc.description ? <span> &middot; {doc.description}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a
            href={doc.url}
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <DownloadIcon />
            Download
          </a>
          {kind !== "other" ? (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 dark:border-sky-800 dark:bg-transparent dark:text-sky-300 dark:hover:bg-sky-950/40"
            >
              <PrintIcon />
              Print
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900">
        {kind === "pdf" ? (
          <iframe
            key={doc.id}
            ref={frameRef}
            src={`${doc.url}#view=FitH`}
            title={doc.title}
            className="h-[70vh] min-h-[420px] w-full"
          />
        ) : kind === "image" ? (
          <iframe
            key={doc.id}
            ref={frameRef}
            srcDoc={`<html><body style="margin:0;display:flex;justify-content:center;background:#f3f4f6"><img src="${escapeAttr(doc.url)}" alt="" style="max-width:100%;height:auto"></body></html>`}
            title={doc.title}
            className="h-[70vh] min-h-[420px] w-full"
          />
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-6 text-center">
            <DocIcon className="text-sky-600 dark:text-sky-300" large />
            <p className="max-w-sm text-sm text-gray-600 dark:text-gray-300">
              This file can&apos;t be previewed here. Open it to view or print.
            </p>
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-[#12386a] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0e2c54]"
            >
              Open document
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder, label }) {
  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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
        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-sky-900/40"
      />
    </div>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
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

function DocIcon({ className = "", large = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={`${large ? "h-10 w-10" : "h-6 w-6"} ${className}`}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v4.5h4.5M9 12.5h6M9 16h4" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
    </svg>
  );
}

function fileKind(url) {
  const path = String(url || "").split(/[?#]/)[0].toLowerCase();
  if (path.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(path)) return "image";
  return "other";
}

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function formatLongDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
