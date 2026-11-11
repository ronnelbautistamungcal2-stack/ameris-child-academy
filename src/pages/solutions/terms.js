import SolutionsLayout, { NAVY } from "@/components/solutions/SolutionsLayout";
import { SOLUTIONS_INFO } from "@/components/solutions/siteInfo";
import { currentDocuments } from "@/lib/terms";

// Ameris Solutions website: Terms of Service. Shows the Website Terms of
// Service published under Global admin > Terms & Agreements, else the
// End-User Terms of Use.

export async function getServerSideProps() {
  const docs = await currentDocuments(["TERMS_OF_SERVICE", "END_USER"]);
  const doc = docs.TERMS_OF_SERVICE || docs.END_USER || null;
  return { props: { doc: doc ? { title: doc.title, version: doc.version, body: doc.body } : null } };
}

export default function SolutionsTerms({ doc }) {
  return (
    <SolutionsLayout title="Terms of Service">
      <section className="mx-auto max-w-3xl px-4 pb-14 pt-2 sm:px-6">
        <h1 className={`font-serif text-4xl font-bold ${NAVY}`}>{doc?.title || "Terms of Service"}</h1>
        {doc ? (
          <>
            <p className="mt-1 text-sm text-gray-500">Version {doc.version}</p>
            <div className="mt-6 whitespace-pre-wrap leading-relaxed text-gray-800">{doc.body}</div>
          </>
        ) : (
          <p className="mt-6 text-gray-700">Our terms are being prepared. Questions? Contact us at {SOLUTIONS_INFO.email}.</p>
        )}
      </section>
    </SolutionsLayout>
  );
}
