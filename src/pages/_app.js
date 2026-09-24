import "../styles/globals.css";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/contexts/ToastContext";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import PageLoadingBar from "@/components/ui/PageLoadingBar";
import PortalShell from "@/components/shell/PortalShell";

// Routes that live inside the signed-in portal. They share one PortalShell
// mounted here, so moving between them swaps only the page body: the sidebar
// and the banner header stay mounted instead of being rebuilt per page.
const PORTAL_ROUTES = ["/dashboard", "/settings", "/parent"];

function usesPortalShell(pathname) {
  return PORTAL_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}) {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Only run the worker in production. In development it caches the
    // /_next/static chunks it sees first and then serves those instead of the
    // code being edited, which looks like pages that never update until the
    // dev server is restarted. _document.js clears any worker left behind.
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("SW registration failed:", err);
    });
  }, []);

  const page = <Component {...pageProps} />;
  const inPortal = !Component.noPortalShell && usesPortalShell(router.pathname);

  return (
    <SessionProvider session={session}>
      <ThemeProvider>
        <ToastProvider>
          <ErrorBoundary>
            <PageLoadingBar />
            {inPortal ? <PortalShell>{page}</PortalShell> : page}
          </ErrorBoundary>
        </ToastProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
