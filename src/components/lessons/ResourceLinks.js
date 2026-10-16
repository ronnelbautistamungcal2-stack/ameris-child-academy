// Lesson "Additional Resources": a newline-separated list of uploaded files
// (/uploads/...) and external links. Teachers may open, download and copy
// these, unlike the protected Lesson file.

export function splitResourceList(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
}

function isUploadedFile(value) {
  return /^\/(uploads|api\/v1\/protected-files)\//.test(value);
}

export function isOpenableResource(value) {
  return /^https?:\/\//i.test(value) || value.startsWith("/");
}

// Uploaded files are stored under random UUID names, so show "File 1 (PDF)"
// instead of the UUID.
export function resourceLabel(value, index) {
  if (!isUploadedFile(value)) return value;
  const ext = (value.split(".").pop() || "").toUpperCase();
  return `File ${index + 1}${ext && ext.length <= 5 ? ` (${ext})` : ""}`;
}

export default function ResourceLinks({ value, className = "", linkClassName = "" }) {
  const resources = splitResourceList(value);
  if (!resources.length) return null;
  return (
    <ul className={className}>
      {resources.map((r, i) => (
        <li key={`${r}-${i}`}>
          {isOpenableResource(r) ? (
            <span className="inline-flex flex-wrap items-center gap-x-2">
              <a
                href={r}
                target="_blank"
                rel="noreferrer"
                className={`break-all text-blue-600 hover:text-blue-700 ${linkClassName}`}
              >
                {resourceLabel(r, i)}
              </a>
              {isUploadedFile(r) ? (
                <a
                  href={r}
                  download
                  className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                >
                  Download
                </a>
              ) : null}
            </span>
          ) : (
            <span className="text-gray-800">{r}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
