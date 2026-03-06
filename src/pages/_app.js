import "../styles/globals.css";
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/contexts/ToastContext";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import PageLoadingBar from "@/components/ui/PageLoadingBar";

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("SW registration failed:", err);
      });
    }
  }, []);

  return (
    <SessionProvider session={session}>
      <ThemeProvider>
        <ToastProvider>
          <ErrorBoundary>
            <PageLoadingBar />
            <Component {...pageProps} />
          </ErrorBoundary>
        </ToastProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
