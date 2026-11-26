import { useMemo, useState } from "react";

const fullName = (c) => [c.firstName, c.lastName].filter(Boolean).join(" ");

/**
 * "Copy from another child": type part of a child's name to narrow the list
 * (client sheet 10-29 (11), row 65), then pick the child.
 */
export default function ChildCopyPicker({ childList = [], value, onChange, label = "Copy from", className = "", style }) {
  const [search, setSearch] = useState("");
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...childList].sort((a, b) => fullName(a).localeCompare(fullName(b)));
    return q ? list.filter((c) => fullName(c).toLowerCase().includes(q)) : list;
  }, [childList, search]);

  function onSearch(text) {
    setSearch(text);
    const q = text.trim().toLowerCase();
    const matches = q ? childList.filter((c) => fullName(c).toLowerCase().includes(q)) : [];
    // One match: pick it; the picked child no longer matching: clear it.
    if (matches.length === 1) onChange(matches[0].id);
    else if (value && q && !matches.some((c) => c.id === value)) onChange("");
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search a child's name..."
        aria-label={`${label}: search a child's name`}
        className={className}
        style={style}
      />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={className} style={style}>
        <option value="">{shown.length ? "Copy from another child..." : "No child matches"}</option>
        {shown.map((c) => (
          <option key={c.id} value={c.id}>
            {fullName(c)}
          </option>
        ))}
      </select>
    </span>
  );
}
