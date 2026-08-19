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
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
