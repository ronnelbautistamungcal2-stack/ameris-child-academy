import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentButton,
  ParentPageHeader,
  ParentSection,
} from "@/components/parent/ParentUI";
import { PUBLIC_CONTACT } from "@/components/public/siteData";

function ContactRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-100 py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-6 dark:border-gray-700">
      <div className="w-40 shrink-0 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="text-sm font-semibold text-[#12386a] dark:text-slate-100">
        {children}
      </div>
    </div>
  );
}

export default function ParentContact() {
  return (
    <ParentLayout title="Contact Us">
      <div className="space-y-4">
        <ParentPageHeader eyebrow="" title="Contact Us" accent="sky" />

        <ParentSection title="Center details">
          <ContactRow label="Phone">
            <a
              href={PUBLIC_CONTACT.phoneHref}
              className="text-sky-700 hover:text-sky-800 dark:text-sky-400"
            >
              {PUBLIC_CONTACT.phoneDisplay}
            </a>
          </ContactRow>
          <ContactRow label="Email">
            <a
              href={`mailto:${PUBLIC_CONTACT.email}`}
              className="text-sky-700 hover:text-sky-800 dark:text-sky-400"
            >
              {PUBLIC_CONTACT.email}
            </a>
          </ContactRow>
          <ContactRow label="Address">
            {PUBLIC_CONTACT.addressLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </ContactRow>
          <ContactRow label="Office hours">{PUBLIC_CONTACT.visitHours}</ContactRow>
        </ParentSection>

        <ParentSection title="Send a message instead">
          <ParentButton href="/parent/messages" variant="soft">
            Open Messages
          </ParentButton>
        </ParentSection>
      </div>
    </ParentLayout>
  );
}
