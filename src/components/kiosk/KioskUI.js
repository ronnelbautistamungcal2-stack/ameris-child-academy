import AmerisLogo from "@/components/ui/AmerisLogo";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";
import { useEffect, useState } from "react";

// Shared look of the front-desk kiosk screens (client mockups, 2026-10-02):
// light blue backdrop with leaves, the logo, a live date/time card, big
// touch-friendly PIN boxes and keypad.

export const NAVY = "text-[#0b2f6b]";
export const PIN_LENGTH = 6;

function useNow() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function formatKioskDate(date) {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function formatKioskTime(date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function DateTimeCard({ className = "" }) {
  const now = useNow();
  return (
    <div className={`rounded-2xl border border-sky-100 bg-sky-50/90 px-6 py-3 text-center shadow-sm ${className}`}>
      <div className="text-sm font-semibold text-[#1e4b8f]">{now ? formatKioskDate(now) : " "}</div>
      <div className={`text-3xl font-black ${NAVY}`}>{now ? formatKioskTime(now) : " "}</div>
    </div>
  );
}

function Leaf({ className, flip = false }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M10 110 C 40 80, 60 60, 110 10" stroke="#7aa27a" strokeWidth="3" fill="none" />
      {[20, 38, 56, 74].map((t, i) => (
        <g key={t} transform={`translate(${t + 6} ${104 - t}) rotate(${i % 2 ? 40 : -50})`}>
          <ellipse rx="16" ry="7" fill="#9cc49a" opacity="0.85" />
        </g>
      ))}
    </svg>
  );
}

export function KioskFrame({ children, showClock = true, topLeft = null }) {
  useForceLightTheme();
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#eaf3fc] via-white to-[#e3eefb] text-gray-900">
      <Leaf className="pointer-events-none absolute -left-4 -top-4 h-40 w-40 opacity-80" />
      <Leaf className="pointer-events-none absolute -bottom-6 -right-4 h-44 w-44 rotate-180 opacity-80" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-6">
        <div className="relative flex items-start justify-center">
          {topLeft ? <div className="absolute left-0 top-0">{topLeft}</div> : null}
          <AmerisLogo size="lg" showText={false} showTagline className="max-w-[320px]" />
          {showClock ? <DateTimeCard className="absolute right-0 top-0 hidden sm:block" /> : null}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center py-6">{children}</div>
      </div>
    </div>
  );
}

export function KioskTitle({ children, subtitle }) {
  return (
    <div className="text-center">
      <h1 className={`font-serif text-5xl font-black tracking-tight ${NAVY}`}>{children}</h1>
      <div className="mx-auto mt-4 flex w-64 items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-sky-300" />
        <span className="text-xl text-pink-400">&#9829;</span>
        <span className="h-px flex-1 bg-sky-300" />
      </div>
      {subtitle ? <div className="mt-3 text-xl font-semibold text-[#1e4b8f]">{subtitle}</div> : null}
    </div>
  );
}

export function PinBoxes({ value }) {
  return (
    <div className="mt-6 flex justify-center gap-3" aria-label={`${value.length} of ${PIN_LENGTH} digits entered`}>
      {Array.from({ length: PIN_LENGTH }, (_, i) => (
        <div
          key={i}
          className={`flex h-20 w-16 items-center justify-center rounded-xl border-2 bg-white text-4xl font-black ${NAVY} ${
            i === value.length ? "border-[#1d4ed8]" : "border-[#4b78c2]"
          }`}
        >
          {value[i] ? "•" : ""}
        </div>
      ))}
    </div>
  );
}

/** Number pad that also accepts the physical keyboard. */
export function Keypad({ value, onChange, onEnter, disabled = false }) {
  useEffect(() => {
    function onKey(e) {
      if (disabled) return;
      if (/^\d$/.test(e.key) && value.length < PIN_LENGTH) onChange(value + e.key);
      else if (e.key === "Backspace") onChange(value.slice(0, -1));
      else if (e.key === "Enter" && value.length === PIN_LENGTH) onEnter?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onChange, onEnter, disabled]);

  const press = (digit) => !disabled && value.length < PIN_LENGTH && onChange(value + digit);
  const key = "flex h-14 w-24 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-2xl font-bold text-[#0b2f6b] shadow-sm active:bg-sky-100 disabled:opacity-50";
  return (
    <div className="mt-6 grid grid-cols-3 gap-3">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button key={d} type="button" className={key} onClick={() => press(d)} disabled={disabled}>
          {d}
        </button>
      ))}
      <button type="button" className={key} onClick={() => onChange(value.slice(0, -1))} disabled={disabled} aria-label="Delete">
        &#9003;
      </button>
      <button type="button" className={key} onClick={() => press("0")} disabled={disabled}>
        0
      </button>
    </div>
  );
}

export function KioskButton({ children, variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-[#0b2f6b] text-white hover:bg-[#123d85] border-transparent",
    secondary: "bg-sky-50 text-[#0b2f6b] border-sky-200 hover:bg-sky-100",
    danger: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
    success: "bg-[#2f8f3a] text-white border-transparent hover:bg-[#287c32]",
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-7 py-4 text-xl font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function KioskError({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-center text-lg font-semibold text-red-700">
      {message}
    </div>
  );
}
