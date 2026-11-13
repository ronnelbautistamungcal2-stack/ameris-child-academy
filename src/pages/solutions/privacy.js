import SolutionsLayout, { NAVY } from "@/components/solutions/SolutionsLayout";

// Ameris Solutions website: Privacy Policy. The text is the client's final
// policy ("Ameris Solutions Privacy Policy - Final.pdf", effective
// 2026-11-12), word for word. When they send an update, replace it here and
// change the dates.

const H2 = `mt-10 font-serif text-2xl font-bold ${NAVY}`;
const P = "mt-4 leading-relaxed text-gray-800";
const UL = "mt-4 list-disc space-y-2 pl-6 leading-relaxed text-gray-800";

export default function SolutionsPrivacy() {
  return (
    <SolutionsLayout title="Privacy Policy">
      <article className="mx-auto max-w-3xl px-4 pb-14 pt-2 sm:px-6">
        <h1 className={`font-serif text-4xl font-bold ${NAVY}`}>Ameris Solutions Privacy Policy</h1>
        <p className="mt-4 text-sm text-gray-600">
          <strong>Effective date:</strong> November 12, 2026
          <br />
          <strong>Last updated:</strong> November 12, 2026
        </p>

        <p className={P}>
          Ameris Solutions is childcare management software used by childcare centers, home-based childcare providers, preschools, and schools.
          Ameris Solutions is a trade name of Kingston Laboratories LLC, a Utah limited liability company based in West Valley City, Utah
          (&quot;Ameris Solutions,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;).
        </p>
        <p className={P}>
          This policy explains what information we collect, how we use and protect it, and the choices available to you. It applies to our
          website, amerissolutions.com, to the Ameris Solutions software and mobile applications, and to related support services.
        </p>

        <h2 className={H2}>Our role: centers control their data</h2>
        <p className={P}>
          Childcare providers, preschools, and schools that subscribe to Ameris Solutions are each called a &quot;center&quot; in this policy.
          Each center owns and controls the information it and its users enter about children, families, and staff. We process that information
          only on the center&apos;s behalf and according to our written agreement with that center.
        </p>
        <p className={P}>
          If a subscribing school is covered by the Family Educational Rights and Privacy Act (FERPA) or a state student-data-privacy law, we will
          sign a data-protection addendum with that school on request.
        </p>
        <p className={P}>
          <strong>Parents and guardians:</strong> To see, correct, or delete your child&apos;s records, please contact your child&apos;s center
          directly. If you contact us, we will forward your request to the center and help the center respond. Where the law requires us to act
          on a deletion request directly, we will do so.
        </p>
        <p className={P}>
          For information we collect for our own purposes, such as website visits, sales inquiries, and the contact details of center account
          holders, we are responsible for that information as described in this policy.
        </p>

        <h2 className={H2}>Information we collect</h2>
        <p className={P}>
          <strong>Account and billing information.</strong> Name, email, phone, center name and address, and billing details for each
          center&apos;s account holders. Subscription payments are handled by Stripe, as described under Payments.
        </p>
        <p className={P}>
          <strong>Parent and guardian accounts.</strong> When a center turns on parent access, we collect the parent&apos;s or guardian&apos;s
          name, email, phone, and sign-in details so they can view their own child&apos;s records. Information a parent or guardian enters belongs
          to the center, like all other child and family records.
        </p>
        <p className={P}>
          <strong>Information centers enter about children and families,</strong> such as:
        </p>
        <ul className={UL}>
          <li>Enrollment details: child&apos;s name, birth date, guardians, emergency contacts, and authorized pickups</li>
          <li>Attendance, check-in, and check-out records</li>
          <li>Daily care notes, photos, messages, developmental milestones, assessments, and incident reports</li>
          <li>Health and safety information the center chooses to record, such as allergies, medications, and immunization status</li>
          <li>Meal counts and food program records, which may include household eligibility information</li>
          <li>Custody or court-order notes the center chooses to record</li>
        </ul>
        <p className={P}>
          <strong>Center staff information,</strong> such as names, roles, schedules, training, and certifications.
        </p>
        <p className={P}>
          <strong>Usage and device information,</strong> such as sign-in times, features used, IP address, browser, and device type, collected
          automatically to run and secure the service.
        </p>
        <p className={P}>
          <strong>Website and inquiry information,</strong> such as the name and contact details you submit in a demo request or contact form.
        </p>

        <h2 className={H2}>How we use information</h2>
        <p className={P}>We use information to:</p>
        <ul className={UL}>
          <li>Provide, operate, and support the software for subscribing centers</li>
          <li>Help centers keep accurate records for licensing, food program, and quality program requirements</li>
          <li>Send account, billing, security, and service notices, including trial and renewal reminders</li>
          <li>Respond to inquiries and demo requests, and send updates you agree to receive</li>
          <li>Secure the service, prevent misuse, and fix problems</li>
          <li>Meet our legal, tax, and contract obligations</li>
        </ul>
        <p className={P}>
          We use aggregated or de-identified information, which cannot reasonably identify any child, family, staff member, or center, to operate
          and improve our software.
        </p>

        <h2 className={H2}>What we never do with children&apos;s and family data</h2>
        <ul className={UL}>
          <li>We never sell or rent it.</li>
          <li>We never use it for advertising or marketing, or to build profiles of children or families.</li>
          <li>We never use it to train artificial intelligence models.</li>
          <li>
            We never share it with anyone other than the center and the service providers who help us run the software, except when the law
            requires it or in a business transfer described below.
          </li>
          <li>We use food program household eligibility information only to provide the service to the center and support its program compliance.</li>
        </ul>

        <h2 className={H2}>How we share information</h2>
        <p className={P}>We do not sell or rent personal information. We share it only:</p>
        <ul className={UL}>
          <li>
            <strong>With the subscribing center</strong> that entered it, and with the users the center authorizes.
          </li>
          <li>
            <strong>With service providers</strong> that host the software, process payments, provide electronic signatures, deliver messages and
            email, or provide support. Each is bound by written contract to use the information only to provide services to us, not to disclose it
            further, and to keep it secure. A current list is available on request.
          </li>
          <li>
            <strong>When the law requires it,</strong> such as a valid subpoena or court order. Where lawful, we will refer the requester to the
            center and notify the center before disclosing.
          </li>
          <li>
            <strong>In a business transfer,</strong> if Kingston Laboratories LLC or Ameris Solutions is sold, merged, or reorganized. Any successor
            must honor this policy for information already collected.
          </li>
          <li>
            <strong>With your permission</strong> or at the center&apos;s direction.
          </li>
        </ul>

        <h2 className={H2}>Payments</h2>
        <p className={P}>
          We use Stripe to process payments. Card and bank details are entered directly into Stripe&apos;s secure forms. Ameris Solutions never
          receives or stores full card or bank account numbers. We may see limited details such as the card brand, last four digits, and payment
          status.
        </p>
        <ul className={UL}>
          <li>
            <strong>Subscription payments.</strong> Centers pay their Ameris Solutions subscription through Stripe.
          </li>
          <li>
            <strong>Tuition payments.</strong> When a center turns on online payments, parents and guardians pay the center directly through the
            center&apos;s own Stripe account. The center, not Ameris Solutions, receives the funds and handles refunds and payment disputes. Ameris
            Solutions does not take a fee from tuition payments.
          </li>
          <li>
            <strong>Center verification.</strong> To set up payments, Stripe collects identity, business, and bank information from the center and
            its owners. Each center manages that information directly with Stripe.
          </li>
        </ul>
        <p className={P}>
          Stripe handles payment information under its own privacy policy at{" "}
          <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">
            stripe.com/privacy
          </a>
          .
        </p>

        <h2 className={H2}>How we protect information</h2>
        <p className={P}>We use administrative, technical, and physical safeguards designed to protect information, including:</p>
        <ul className={UL}>
          <li>Encryption of data in transit</li>
          <li>
            Role-based access, so center staff see only what their role allows and parents and guardians see only their own child&apos;s records
          </li>
          <li>Limited access for our own staff, granted only as needed to provide support</li>
          <li>Controls designed to prevent children from creating accounts or using the software directly</li>
          <li>Regular software and security updates</li>
          <li>Data stored on servers located in the United States</li>
        </ul>
        <p className={P}>
          No system is completely secure, so we cannot guarantee absolute security. Center users are responsible for keeping their passwords
          private and limiting access to authorized users.
        </p>

        <h2 className={H2}>If a data breach occurs</h2>
        <p className={P}>
          If we discover unauthorized access to or disclosure of personal information in our care, we will notify affected centers without undue
          delay, and no later than 7 calendar days after discovering the incident. We will notify affected individuals and authorities as required
          by Utah law and any other law that applies, and help centers meet their own notice obligations.
        </p>

        <h2 className={H2}>How long we keep information</h2>
        <p className={P}>
          While a center&apos;s subscription is active, we keep its records so the center can meet its licensing, food program, and
          recordkeeping requirements. The center decides how long to keep individual child and staff records and can delete them in the software.
          A center may also ask us in writing to delete its data at any time.
        </p>
        <p className={P}>When a center&apos;s subscription ends:</p>
        <ol className="mt-4 list-decimal space-y-2 pl-6 leading-relaxed text-gray-800">
          <li>The center has 60 days to export its records, at no charge, in a common machine-readable format.</li>
          <li>We notify the center before we delete its records.</li>
          <li>
            We delete the center&apos;s records from our active systems within 90 days after the export period ends, and from backups in the
            ordinary course of our backup cycle, except where the law requires us to keep them.
          </li>
        </ol>
        <p className={P}>Website inquiry information is kept for up to 3 years unless you become a customer.</p>

        <h2 className={H2}>Cookies and Do Not Track</h2>
        <p className={P}>
          Our website and software use cookies only to keep you signed in, remember your settings, keep the service secure, and measure website
          traffic. We do not use advertising or cross-site tracking cookies. You can block cookies in your browser, but the software will not work
          without the cookies needed for signing in.
        </p>
        <p className={P}>
          Our website does not respond to browser &quot;Do Not Track&quot; signals, because no common standard exists. We do not track you across
          other websites.
        </p>

        <h2 className={H2}>Your choices and requests</h2>
        <p className={P}>Center account holders and website visitors may ask us to:</p>
        <ul className={UL}>
          <li>Tell them what personal information we hold about them</li>
          <li>Correct inaccurate information</li>
          <li>Delete their information, unless we must keep it by law or contract</li>
          <li>Stop sending marketing email, using the unsubscribe link or by contacting us</li>
        </ul>
        <p className={P}>
          Service notices about your account, billing, or security, including trial and renewal reminders, are not optional while you have an
          active trial or subscription. We respond to requests within 30 days and may need to verify your identity first. Parents and guardians
          should send requests about a child&apos;s records to the child&apos;s center, as described above.
        </p>

        <h2 className={H2}>Children&apos;s privacy</h2>
        <p className={P}>
          Ameris Solutions is designed for use by adults: center staff, and parents and guardians when their center turns on parent access.
          Children may not create accounts or use the software directly, and we do not knowingly collect personal information directly from
          children under 13 through our website or software. Information about children is entered only by authorized center staff or by a parent
          or guardian, and it is protected as described in &quot;What we never do with children&apos;s and family data.&quot; If you believe a
          child has given us personal information directly, contact us and we will delete it.
        </p>

        <h2 className={H2}>Other terms</h2>
        <ul className={UL}>
          <li>
            <strong>Links to other websites.</strong> Our website may link to sites we do not control. Their privacy practices are their own.
          </li>
          <li>
            <strong>Employees and job applicants.</strong> This policy does not cover information about our own employees or job applicants.
          </li>
          <li>
            <strong>Location of data.</strong> We operate in the United States and store data in the United States.
          </li>
        </ul>

        <h2 className={H2}>Changes to this policy</h2>
        <p className={P}>
          We will post any update on this page with a new &quot;Last updated&quot; date. For significant changes to how we handle children&apos;s
          or family data, we will notify center account holders by email at least 30 days before the change takes effect.
        </p>

        <h2 className={H2}>Contact us</h2>
        <address className={`${P} not-italic`}>
          Kingston Laboratories LLC, dba Ameris Solutions
          <br />
          2156 West 2200 South, Suite 201
          <br />
          West Valley City, UT 84119
          <br />
          Email:{" "}
          <a href="mailto:privacy@amerissolutions.com" className="underline">
            privacy@amerissolutions.com
          </a>
          <br />
          Phone:{" "}
          <a href="tel:+18013278747" className="underline">
            (801) 327-8747
          </a>
        </address>
      </article>
    </SolutionsLayout>
  );
}
