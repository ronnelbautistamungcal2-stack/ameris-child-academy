import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Ensures mobile/tablet browsers use actual device width instead of desktop-simulation scaling */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme color for browser chrome and PWA */}
        <meta name="theme-color" content="#0284c7" />

        {/* Apple PWA support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Ameris Academy" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        {/* Fallback favicon */}
        <link rel="icon" href="/icons/icon-192.png" />
        {/* Dev only: a service worker registered by an earlier run serves its
            cached /_next/static chunks ahead of the ones being edited, which
            shows up as stale pages (or two shells at once). This runs from the
            HTML, so it heals the browser even when the cached bundle is stale. */}
        {process.env.NODE_ENV === "production" ? null : (
          <script
            dangerouslySetInnerHTML={{
              __html: [
                "if ('serviceWorker' in navigator) {",
                "  navigator.serviceWorker.getRegistrations()",
                "    .then(function (rs) {",
                "      return Promise.all(rs.map(function (r) { return r.unregister(); }));",
                "    })",
                "    .then(function () {",
                "      if (!window.caches) return null;",
                "      return caches.keys().then(function (ks) {",
                "        return Promise.all(ks.map(function (k) { return caches.delete(k); }));",
                "      });",
                "    })",
                "    .catch(function () {});",
                "}",
              ].join("\n"),
            }}
          />
        )}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
