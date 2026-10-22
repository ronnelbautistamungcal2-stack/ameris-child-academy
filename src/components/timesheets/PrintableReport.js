import AmerisLogo from "@/components/ui/AmerisLogo";
import { useForceLightTheme } from "@/hooks/useForceLightTheme";

// Shared frame of the printable time sheet reports: logo and title, a Print
// button that does not print, black text throughout (client request), and the
// date and time the report was generated at the bottom.
export default function PrintableReport({ title, subtitle, header, generatedAt, children }) {
  useForceLightTheme();
  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-4xl px-8 py-8 print:px-0 print:py-0">
        <div className="mb-4 flex justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-50"
          >
            Print
          </button>
        </div>
        <div className="flex items-center gap-6">
          <AmerisLogo size="md" showText={false} className="max-w-[160px]" />
          <div className="flex-1 text-center">
            <h1 className="font-serif text-3xl font-bold text-black">{title}</h1>
            {subtitle ? <div className="mt-1 text-base text-black">{subtitle}</div> : null}
          </div>
          <div className="w-[160px]" aria-hidden="true" />
        </div>
        {header ? <div className="mt-6 border-b border-gray-400 pb-3 text-sm text-black">{header}</div> : null}
        <div className="mt-4">{children}</div>
        {generatedAt ? (
          <div className="mt-8 border-t border-gray-300 pt-2 text-right text-xs text-black">
            Report generated {generatedAt.toLocaleString()}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const reportTable = "w-full border-collapse text-sm text-black";
export const reportTh = "border border-gray-300 bg-[#f3f4f6] px-2 py-1.5 text-center font-semibold text-black";
export const reportTd = "border border-gray-300 px-2 py-1 text-center text-black";
