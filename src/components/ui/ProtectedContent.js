import { useEffect, useState } from "react";

// Content that shouldn't be copied, printed or screenshotted (client sheet
// 10-29 (8), rows 4/12: the Initial Development Assessment). A browser can't
// truly stop screenshots or a phone camera, so this deters: no selecting,
// copying, right-click, dragging, Ctrl+S / Ctrl+P / Ctrl+C; the content blurs
// when the window loses focus or Print Screen is pressed; printing shows a
// notice instead (globals.css hides .protected-content in print).
// Typing in the page's own fields still works.

const block = (e) => e.preventDefault();
const isField = (el) => !!el?.closest?.("input, textarea, select, [contenteditable='true']");

export default function ProtectedContent({ children, label = "Content", className = "" }) {
  const [obscured, setObscured] = useState(false);

  useEffect(() => {
    function onKeyDown(e) {
      const key = String(e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === "s" || key === "p")) {
        e.preventDefault();
        e.stopPropagation();
      }
      // Copying is fine inside the page's own fields, not from the page.
      if ((e.ctrlKey || e.metaKey) && (key === "c" || key === "x" || key === "a") && !isField(e.target)) {
        e.preventDefault();
      }
      if (key === "printscreen") setObscured(true);
    }
    function onKeyUp(e) {
      if (String(e.key || "").toLowerCase() !== "printscreen") return;
      // Windows puts the capture on the clipboard; replace it.
      navigator.clipboard?.writeText?.("").catch(() => {});
      setObscured(true);
    }
    const hide = () => setObscured(true);
    const onVisibility = () => {
      if (document.hidden) setObscured(true);
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", hide);
    window.addEventListener("beforeprint", hide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", hide);
      window.removeEventListener("beforeprint", hide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div
      className={`protected-content relative select-none ${className}`}
      onContextMenu={(e) => !isField(e.target) && block(e)}
      onCopy={(e) => !isField(e.target) && block(e)}
      onCut={(e) => !isField(e.target) && block(e)}
      onDragStart={block}
      style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
    >
      <div style={obscured ? { filter: "blur(18px)", pointerEvents: "none" } : undefined} aria-hidden={obscured || undefined}>
        {children}
      </div>
      {obscured ? (
        <button
          type="button"
          onClick={() => setObscured(false)}
          className="absolute inset-0 flex items-start justify-center pt-24 text-sm font-semibold text-gray-800"
        >
          <span className="rounded-lg bg-white/95 px-4 py-2 shadow">{label} hidden. Click to keep working</span>
        </button>
      ) : null}
    </div>
  );
}
