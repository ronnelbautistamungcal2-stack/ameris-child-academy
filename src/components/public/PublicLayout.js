import Head from "next/head";
import { useRouter } from "next/router";
import PublicNavbar from "./PublicNavbar";
import PublicFooter from "./PublicFooter";
import { SITE_NAME, SITE_TAGLINE } from "./siteData";

export default function PublicLayout({ title, description, children }) {
  const router = useRouter();
  const pageTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const metaDescription = description || SITE_TAGLINE;
  const siteUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const canonicalPath = (router.asPath || "/").split("?")[0].split("#")[0];
  const canonicalUrl = `${siteUrl}${canonicalPath === "/" ? "" : canonicalPath}`;
  const socialImage = `${siteUrl}/icons/icon-512.png`;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f172a" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={socialImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={socialImage} />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="manifest" href="/manifest.json" />
      </Head>
      <div className="min-h-screen">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <PublicNavbar />
        <main id="main-content" className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.28),_transparent_44%),radial-gradient(circle_at_85%_8%,_rgba(253,230,138,0.22),_transparent_22%)]" />
          {children}
        </main>
        <PublicFooter />
      </div>
    </>
  );
}
