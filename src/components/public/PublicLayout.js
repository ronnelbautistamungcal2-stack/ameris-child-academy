import Head from "next/head";
import PublicNavbar from "./PublicNavbar";
import PublicFooter from "./PublicFooter";

export default function PublicLayout({ title, description, children }) {
  const pageTitle = title ? `${title} | Ameris Child Academy` : "Ameris Child Academy";

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        {description && <meta name="description" content={description} />}
      </Head>
      <div className="min-h-screen">
        <PublicNavbar />
        <main className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.28),_transparent_44%),radial-gradient(circle_at_85%_8%,_rgba(253,230,138,0.22),_transparent_22%)]" />
          {children}
        </main>
        <PublicFooter />
      </div>
    </>
  );
}
