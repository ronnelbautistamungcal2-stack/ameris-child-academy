import Image from "next/image";
import Link from "next/link";
import AmerisLogo from "@/components/ui/AmerisLogo";
import { MailIcon, MapPinIcon, PhoneIcon } from "./icons";
import { PUBLIC_CONTACT, SITE_TAGLINE } from "./siteData";

export default function PublicFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-[#d9e7fb]">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/homepage-assets/Image_Bottom.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      <div className="relative w-full pt-8">
        <div className="px-6 py-6 lg:px-10">
          <div className="grid gap-8 md:grid-cols-[1.15fr_1fr_1.2fr]">
            <div className="min-w-0">
              <Link href="/" className="block w-[clamp(200px,32vw,300px)]">
                <AmerisLogo size="xl" showText={false} className="drop-shadow-sm" />
              </Link>
              <p className="mt-3 text-[12px] font-semibold text-slate-700">{SITE_TAGLINE}</p>
            </div>

            <div>
              <h2 className="text-[15px] font-black text-slate-800">Contact Us</h2>
              <div className="mt-3 space-y-3 text-[13px] text-slate-800">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-[#1f3c91]">
                    <MapPinIcon className="h-4 w-4" />
                  </span>
                  <span>
                    {PUBLIC_CONTACT.addressLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                </div>
                <a href={PUBLIC_CONTACT.phoneHref} className="flex items-start gap-3 hover:text-[#1f3c91]">
                  <span className="mt-0.5 text-[#1f3c91]">
                    <PhoneIcon className="h-4 w-4" />
                  </span>
                  <span>{PUBLIC_CONTACT.phoneDisplay}</span>
                </a>
                <a href={`mailto:${PUBLIC_CONTACT.email}`} className="flex items-start gap-3 hover:text-[#1f3c91]">
                  <span className="mt-0.5 text-[#1f3c91]">
                    <MailIcon className="h-4 w-4" />
                  </span>
                  <span>{PUBLIC_CONTACT.email}</span>
                </a>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-[#1f3c91]">
                    <ClockIcon className="h-4 w-4" />
                  </span>
                  <span>{PUBLIC_CONTACT.visitHours}</span>
                </div>
              </div>
            </div>

            <div className="text-[13px] leading-6 text-slate-800">
              <p>
                Ameris Academy Inc is an equal opportunity provider. It admits children of any race,
                color, national and ethnic origin to all the rights, privileges, programs, and activities
                generally accorded or made available to children at the center.
              </p>
              <p className="mt-3">
                It does not discriminate on the basis of race, color, national and ethnic origin in
                administration of its admissions policies, activities, and other programs.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#163c96] px-0 py-2 text-center text-[12px] text-white">
          &copy; {new Date().getFullYear()} Ameris Academy Inc. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}

function ClockIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
    </svg>
  );
}
