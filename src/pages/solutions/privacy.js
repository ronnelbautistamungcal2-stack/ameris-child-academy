import SolutionsLayout, { NAVY } from "@/components/solutions/SolutionsLayout";
import { SOLUTIONS_INFO } from "@/components/solutions/siteInfo";

// Ameris Solutions website: Privacy Policy. The client hasn't sent the policy
// text yet; this page says so.

export default function SolutionsPrivacy() {
  return (
    <SolutionsLayout title="Privacy Policy">
      <section className="mx-auto max-w-3xl px-4 pb-14 pt-2 sm:px-6">
        <h1 className={`font-serif text-4xl font-bold ${NAVY}`}>Privacy Policy</h1>
        <p className="mt-6 leading-relaxed text-gray-800">
          Ameris Solutions does not sell your information or use it for advertising. We use the information you share with us only to respond to you
          and to provide our services. Our full privacy policy is being prepared. Questions? Contact us at {SOLUTIONS_INFO.email}.
        </p>
      </section>
    </SolutionsLayout>
  );
}
