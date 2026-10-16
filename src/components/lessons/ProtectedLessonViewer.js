import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

// Shows the protected "Lesson" file(s) of a curriculum lesson. Files are
// drawn onto <canvas> elements, so there is no browser PDF toolbar, no
// selectable text and no image to "Save as". Copy, right-click, drag, print
// and save shortcuts are blocked, every page carries the viewer's name as a
// watermark, and the pages blur while the window is not focused.
//
// None of this can stop a phone camera or every screen-capture tool; the
// watermark is what makes a leaked copy traceable.

let pdfjsPromise = null;
function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
      // webpack bundles the worker from this URL. pdf.js's main-thread
      // fallback stalls on pages with images, so a real worker is required.
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL("pdfjs-dist/legacy/build/pdf.worker.min.js", import.meta.url),
      );
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

function isPdf(url, contentType) {
  return /pdf/i.test(contentType || "") || /\.pdf($|\?)/i.test(url);
}

function drawWatermark(ctx, width, height, text) {
  if (!text) return;
  const fontSize = Math.max(14, Math.round(width / 38));
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = "#1e3a8a";
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  const stepX = ctx.measureText(text).width + fontSize * 4;
  const stepY = fontSize * 6;
  const span = Math.hypot(width, height);
  for (let y = -span; y < span; y += stepY) {
    const offset = (Math.round(y / stepY) % 2) * (stepX / 2);
    for (let x = -span; x < span; x += stepX) {
      ctx.fillText(text, x + offset, y);
    }
  }
  ctx.restore();
}

function newCanvas(cssWidth, pixelWidth, pixelHeight) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(pixelWidth);
  canvas.height = Math.round(pixelHeight);
  canvas.style.width = "100%";
  canvas.style.maxWidth = `${cssWidth}px`;
  canvas.style.height = "auto";
  canvas.style.display = "block";
  canvas.className = "mx-auto rounded border border-gray-200 bg-white shadow-sm";
  canvas.setAttribute("draggable", "false");
  return canvas;
}

async function renderFile({ url, container, cssWidth, watermark, isCancelled }) {
  const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error("This lesson file could not be loaded.");
  const contentType = res.headers.get("content-type") || "";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = cssWidth * dpr;

  if (isPdf(url, contentType)) {
    const pdfjs = await loadPdfJs();
    const data = new Uint8Array(await res.arrayBuffer());
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
    try {
      for (let n = 1; n <= doc.numPages; n += 1) {
        if (isCancelled()) return;
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: targetWidth / base.width });
        const canvas = newCanvas(cssWidth, viewport.width, viewport.height);
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;
        drawWatermark(ctx, canvas.width, canvas.height, watermark);
        if (isCancelled()) return;
        container.appendChild(canvas);
      }
    } finally {
      doc.destroy();
    }
    return;
  }

  const bitmap = await createImageBitmap(await res.blob());
  const scale = Math.min(1, targetWidth / bitmap.width);
  const canvas = newCanvas(cssWidth, bitmap.width * scale, bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  drawWatermark(ctx, canvas.width, canvas.height, watermark);
  if (!isCancelled()) container.appendChild(canvas);
}

const blockEvent = (e) => e.preventDefault();

export default function ProtectedLessonViewer({ urls, className = "" }) {
  const { data: session } = useSession();
  const pagesRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [obscured, setObscured] = useState(false);

  const viewer = session?.user?.name || session?.user?.email || "";
  const watermark = viewer
    ? `${viewer} · ${new Date().toLocaleDateString()} · Ameris Academy`
    : "Ameris Academy · Do not copy";
  const urlKey = (urls || []).join("\n");

  useEffect(() => {
    const container = pagesRef.current;
    if (!container || !urlKey) return undefined;
    let cancelled = false;
    container.replaceChildren();
    setStatus("loading");
    setError("");
    const cssWidth = Math.max(280, Math.min(container.clientWidth || 800, 1000));

    (async () => {
      try {
        for (const url of urlKey.split("\n")) {
          if (cancelled) return;
          await renderFile({
            url,
            container,
            cssWidth,
            watermark,
            isCancelled: () => cancelled,
          });
        }
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "This lesson file could not be displayed.");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [urlKey, watermark]);

  useEffect(() => {
    function onKeyDown(e) {
      const key = String(e.key || "").toLowerCase();
      // Save and print only: the pages are canvases with no text to copy, and
      // the Additional Resources next to them must stay copyable.
      if ((e.ctrlKey || e.metaKey) && (key === "s" || key === "p")) {
        e.preventDefault();
        e.stopPropagation();
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
    const beforePrint = () => setObscured(true);

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", hide);
    window.addEventListener("beforeprint", beforePrint);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", hide);
      window.removeEventListener("beforeprint", beforePrint);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!urlKey) return null;

  return (
    <div
      className={`protected-lesson relative select-none ${className}`}
      onContextMenu={blockEvent}
      onCopy={blockEvent}
      onCut={blockEvent}
      onDragStart={blockEvent}
      style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
    >
      <div
        ref={pagesRef}
        className="space-y-3 rounded-lg bg-gray-100 p-2"
        style={obscured ? { filter: "blur(18px)" } : undefined}
      />
      {status === "loading" ? (
        <div className="py-6 text-center text-sm text-gray-500">Loading lesson…</div>
      ) : null}
      {status === "error" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {obscured && status !== "error" ? (
        <button
          type="button"
          onClick={() => setObscured(false)}
          className="absolute inset-0 flex items-start justify-center pt-16 text-sm font-semibold text-gray-800"
        >
          <span className="rounded-lg bg-white/90 px-4 py-2 shadow">
            Lesson hidden — click to keep reading
          </span>
        </button>
      ) : null}
    </div>
  );
}
