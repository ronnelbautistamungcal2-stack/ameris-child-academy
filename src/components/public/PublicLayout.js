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
      <div className="min-h-screen bg-gray-50">
        <PublicNavbar />
        <main>{children}</main>
        <PublicFooter />
      </div>
    </>
  );
}
