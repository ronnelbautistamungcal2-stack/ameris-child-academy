import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import PublicLayout from "@/components/public/PublicLayout";
import { MapPinIcon, PhoneIcon } from "@/components/public/icons";
import { PUBLIC_CONTACT } from "@/components/public/siteData";

const PROGRAMS = [
  {
    title: "Infants",
    ageRange: "0 – 12 months",
    imageSrc: "/homepage-assets/Infants.webp",
    labelClassName: "bg-[#fbe3ea]",
  },
  {
    title: "Toddlers",
    ageRange: "1 – 2 years",
    imageSrc: "/homepage-assets/Toddlers.webp",
    labelClassName: "bg-[#def3d9]",
  },
  {
    title: "Preschool",
    ageRange: "3 – 5 years",
    imageSrc: "/homepage-assets/Pre-K.webp",
    labelClassName: "bg-[#e7e1f6]",
  },
  {
    title: "School Age",
    ageRange: "6 – 12 years",
    imageSrc: "/homepage-assets/New_School_Age.webp",
    labelClassName: "bg-[#fdf1c4]",
  },
];

const FEATURES = [
  {
    title: "Safe & Nurturing",
    description: "A secure environment where every child is valued and cared for.",
    circleClassName: "bg-[#ec5f84]",
    Icon: HeartGlyph,
  },
  {
    title: "Hands-On Learning",
    description: "Experiences that inspire curiosity and development.",
    circleClassName: "bg-[#2f7fd6]",
    Icon: BookGlyph,
  },
  {
    title: "Character & Responsibility",
    description: "Building positive relationships, teamwork, and leadership.",
    circleClassName: "bg-[#3a9950]",
    Icon: PeopleGlyph,
  },
  {
    title: "Indoor & Outdoor Play",
    description: "Engaging activities that keep children active, creative, and social.",
    circleClassName: "bg-[#8d5fd8]",
    Icon: PlayGlyph,
  },
  {
    title: "Healthy Nutrition",
    description: "Fresh vegetables grown in our organic greenhouse for healthier children.",
    circleClassName: "bg-[#f4a623]",
    Icon: AppleGlyph,
  },
];

// Height of the absolutely positioned public navbar: logo width / logo aspect + py-4.
const NAVBAR_OFFSET = "calc(clamp(170px, 22vw, 270px) / 1.985 + 2rem)";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (session) {
      router.replace("/dashboard");
    }
  }, [session, status, router]);

  if (status === "loading" || session) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white">
        <div className="animate-fade-in flex flex-col items-center">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 shadow-lg shadow-sky-200">
              <svg
                viewBox="0 0 32 32"
                className="h-9 w-9 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 6c-3 0-5.5 2-6.5 4.5C8.5 8 6 8.5 4.5 11 3 13.5 3.5 16.5 5 18.5L16 28l11-9.5c1.5-2 2-5 .5-7.5S23.5 8 22.5 10.5C21.5 8 19 6 16 6z" />
              </svg>
            </div>
            <div className="absolute -inset-3 animate-ping rounded-3xl border-2 border-sky-200 opacity-30" />
          </div>
          <h2 className="mt-5 text-lg font-extrabold tracking-tight text-gray-900">
            Ameris Academy
          </h2>
          <div className="mt-4 flex gap-1.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: "0ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: "150ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <PublicLayout
      title="Home"
      description="Nurturing blessings, building character, raising pillars at Ameris Academy."
    >
      <HeroSection />
      <ProgramsSection />
      <FeaturesSection />
      <AboutContactSection />
    </PublicLayout>
  );
}

function HeroSection() {
  return (
    <section className="relative bg-white" style={{ paddingTop: NAVBAR_OFFSET }}>
      <div className="relative">
        <div className="relative min-h-[300px] w-full overflow-hidden md:aspect-[2062/763] md:min-h-0">
          <Image
            src="/homepage-assets/Hero_Pillar.webp"
            alt="Children climbing marble steps toward a pillar at sunrise"
            fill
            sizes="100vw"
            priority
            className="object-cover object-[32%_center] md:object-center"
          />
          {/* Soft white fade into the header above and the programs section below. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[12%] bg-gradient-to-b from-white/85 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[26%] bg-gradient-to-t from-white via-white/70 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[8%] bg-gradient-to-l from-white/60 to-transparent" />

          <div className="absolute inset-x-0 top-[7%] px-5 md:left-[2.5%] md:right-auto md:w-[36%] md:px-0">
            <h1
              className="text-center font-serif text-[clamp(1.6rem,2.9vw,3rem)] font-semibold leading-[1.18] text-[#16275e]"
              style={{ textShadow: "0 1px 12px rgba(255,255,255,0.75)" }}
            >
              Nurturing Blessings,
              <br />
              Building Character,
              <br />
              Raising Pillars.
            </h1>
          </div>

          <div className="absolute right-[5%] top-[8%] hidden w-[38%] md:block">
            <HeroVideo />
          </div>
        </div>

        <div className="relative -mt-10 px-5 md:hidden">
          <HeroVideo />
        </div>
      </div>
    </section>
  );
}

function HeroVideo() {
  const videoRef = useRef(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [duration, setDuration] = useState(0);

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    void video.play();
    setHasStarted(true);
  };

  return (
    <div className="rounded-[12px] bg-white p-[6px] shadow-[0_22px_48px_-24px_rgba(20,40,90,0.55)] ring-1 ring-slate-200">
      <div className="relative aspect-video overflow-hidden rounded-[8px] bg-[linear-gradient(180deg,#f6f7fa_0%,#e9ecf2_100%)]">
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover transition ${hasStarted ? "opacity-100" : "opacity-0"}`}
          src="/home-video.mp4"
          playsInline
          preload="metadata"
          controls={hasStarted}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
          onEnded={() => setHasStarted(false)}
        />

        {!hasStarted && (
          <button
            type="button"
            onClick={handlePlay}
            className="group absolute inset-0 z-10 block text-left"
            aria-label="Play video"
          >
            <span className="absolute inset-x-[22%] top-[10%] h-[42%]">
              <Image
                src="/ameris-logo-transparent.png"
                alt=""
                fill
                sizes="(max-width: 768px) 60vw, 22vw"
                className="object-contain"
              />
            </span>

            <span className="absolute left-1/2 top-[64%] flex h-[20%] min-h-[40px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#3b3f46]/85 text-white shadow-lg transition group-hover:scale-105 group-hover:bg-[#2a2d33]" style={{ aspectRatio: "1 / 1" }}>
              <svg viewBox="0 0 24 24" className="ml-[8%] h-1/2 w-1/2" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l10.5-6.5L8 5.5z" />
              </svg>
            </span>

            <span className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 bg-gradient-to-t from-black/70 to-black/25 px-3 py-1.5 text-[11px] font-medium text-white sm:text-[12px]">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden="true">
                <path d="M7 5v14l11-7L7 5z" />
              </svg>
              <span className="shrink-0 tabular-nums">0:00 / {formatTime(duration)}</span>
              <span className="h-[3px] flex-1 rounded-full bg-white/40" />
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
                <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4z" />
              </svg>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds) {
  const total = Math.floor(seconds || 0);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

function ProgramsSection() {
  return (
    <section className="bg-white pt-8 md:pt-4">
      <div className="mx-auto w-full max-w-[1280px] px-5 lg:px-10">
        <div className="text-center">
          <h2 className="font-serif text-[clamp(1.75rem,3vw,2.6rem)] font-bold leading-tight text-[#16275e]">
            Programs for Every Stage
          </h2>
          <p className="mt-1.5 font-serif text-[15px] text-slate-700 sm:text-[17px]">
            Quality care that nurtures learning, character, and growth from infancy through age 12
          </p>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {PROGRAMS.map((program) => (
            <Link
              key={program.title}
              href="/programs"
              className="group overflow-hidden rounded-[10px] bg-white shadow-[0_14px_30px_-20px_rgba(20,40,90,0.55)] ring-1 ring-slate-200 transition hover:-translate-y-0.5"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={program.imageSrc}
                  alt={`${program.title} classroom`}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className={`px-3 py-3 text-center ${program.labelClassName}`}>
                <h3 className="font-serif text-[1.1rem] font-bold leading-tight text-[#1d3c8a] sm:text-[1.3rem]">
                  {program.title}
                </h3>
                <p className="mt-0.5 font-serif text-[13px] text-slate-700 sm:text-[14px]">{program.ageRange}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="bg-white pb-10 pt-8">
      <div className="mx-auto w-full max-w-[1280px] px-5 lg:px-10">
        <div className="grid grid-cols-2 gap-y-7 sm:grid-cols-3 md:grid-cols-5 md:gap-y-0 md:divide-x md:divide-slate-300">
          {FEATURES.map(({ title, description, circleClassName, Icon }) => (
            <article key={title} className="px-3 text-center lg:px-5">
              <span
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_8px_16px_-10px_rgba(0,0,0,0.5)] sm:h-16 sm:w-16 ${circleClassName}`}
              >
                <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
              </span>
              <h3 className="mt-3 font-serif text-[14px] font-bold leading-snug text-[#16275e] sm:text-[15px]">
                {title}
              </h3>
              <p className="mx-auto mt-1.5 max-w-[210px] font-serif text-[12.5px] leading-[1.45] text-slate-600 sm:text-[13px]">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutContactSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#f3f6fb] to-[#e8eef7] pb-24 pt-10 sm:pb-28">
      <LeafSprig className="pointer-events-none absolute -left-4 bottom-10 hidden h-44 w-24 text-[#6fa24a] md:block" />
      <LeafSprig className="pointer-events-none absolute -right-4 top-4 hidden h-44 w-24 -scale-x-100 text-[#6fa24a] md:block" />

      <div className="relative mx-auto grid w-full max-w-[1120px] gap-8 px-6 md:grid-cols-[1.55fr_1fr] md:gap-0 lg:px-10">
        <div className="md:pr-10">
          <h2 className="font-serif text-[clamp(1.6rem,2.6vw,2.3rem)] font-bold leading-tight text-[#16275e]">
            About Ameris Academy
          </h2>
          <p className="mt-3 font-serif text-[14px] leading-[1.6] text-slate-700 sm:text-[15px]">
            We believe every child is a blessing. Through quality care, a loving environment, and
            character training, we nurture each child as they learn, build confidence, develop
            character, and form meaningful relationships, while preparing them to be the pillars of
            tomorrow.
          </p>
          <Link
            href="/about"
            className="mt-5 inline-flex items-center rounded-[6px] bg-[#1f5aa8] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_10px_20px_-14px_rgba(31,90,168,0.9)] transition hover:bg-[#184a8c]"
          >
            Learn More About Us
          </Link>
        </div>

        <div className="border-t border-slate-300 pt-8 md:border-l md:border-t-0 md:pl-10 md:pt-0">
          <h2 className="font-serif text-[clamp(1.6rem,2.6vw,2.3rem)] font-bold leading-tight text-[#16275e]">
            Contact Us
          </h2>
          <div className="mt-4 space-y-4 font-serif text-[15px] text-slate-800 sm:text-[16px]">
            <a href={PUBLIC_CONTACT.phoneHref} className="flex items-center gap-4 transition hover:text-[#1f5aa8]">
              <PhoneIcon className="h-5 w-5 shrink-0 text-[#16275e]" />
              <span>{PUBLIC_CONTACT.phoneDisplay}</span>
            </a>
            <div className="flex items-start gap-4">
              <MapPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#16275e]" />
              <span>
                {PUBLIC_CONTACT.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LeafSprig({ className = "" }) {
  const leaves = [
    { x: 40, y: 22, r: -35 },
    { x: 62, y: 44, r: 40 },
    { x: 34, y: 70, r: -40 },
    { x: 60, y: 94, r: 45 },
    { x: 30, y: 120, r: -45 },
    { x: 56, y: 146, r: 50 },
    { x: 28, y: 170, r: -50 },
  ];

  return (
    <svg viewBox="0 0 100 220" className={className} fill="currentColor" aria-hidden="true">
      <path
        d="M20 218C30 170 38 120 44 70 47 45 48 25 46 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      {leaves.map((leaf) => (
        <ellipse
          key={`${leaf.x}-${leaf.y}`}
          cx={leaf.x}
          cy={leaf.y}
          rx="9"
          ry="19"
          transform={`rotate(${leaf.r} ${leaf.x} ${leaf.y})`}
          opacity="0.75"
        />
      ))}
    </svg>
  );
}

function HeartGlyph({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.6a4.3 4.3 0 017.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" />
    </svg>
  );
}

function BookGlyph({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 6.5C10 5 7 4.6 3.5 5v13c3.5-.4 6.5 0 8.5 1.5 2-1.5 5-1.9 8.5-1.5V5C17 4.6 14 5 12 6.5z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

function PeopleGlyph({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="6.5" r="2.6" />
      <circle cx="5.5" cy="8.5" r="2.1" />
      <circle cx="18.5" cy="8.5" r="2.1" />
      <path d="M8.2 19v-4.3A3.8 3.8 0 0112 11a3.8 3.8 0 013.8 3.7V19H8.2z" />
      <path d="M2 19v-3.2A3 3 0 015.5 13a3.4 3.4 0 011.7.5 5.3 5.3 0 00-.5 2.2V19H2zM22 19v-3.2a3 3 0 00-3.5-2.8 3.4 3.4 0 00-1.7.5 5.3 5.3 0 01.5 2.2V19H22z" />
    </svg>
  );
}

function PlayGlyph({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <circle cx="7" cy="4.8" r="2.1" />
      <circle cx="17" cy="4.8" r="2.1" />
      <path d="M7 8c-1.3 0-2.2.8-2.4 2l-.8 4.2 1.8.4.6-2.6.5 3.4-1.7 5.6 1.9.6 1.6-5 1.2 5h2l-1.6-6.3.4-3.2 1.5 1.6 2-.9-2.8-3.4C8.6 8.4 7.9 8 7 8z" />
      <path d="M17 8c-.9 0-1.6.4-2.2 1.2l-2.3 3.1 1.9.9 1.4-1.6.4 3.2-1.6 6.3h2l1.2-5 1.6 5 1.9-.6-1.7-5.6.5-3.4.6 2.6 1.8-.4-.8-4.2C19.2 8.8 18.3 8 17 8z" />
    </svg>
  );
}

function AppleGlyph({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.4 8.2c-1.6 0-2.6.8-4.4.8s-2.8-.8-4.4-.8C5.3 8.2 3.8 10.5 3.8 13.4c0 4 2.8 8.1 5.3 8.1 1.2 0 1.7-.7 2.9-.7s1.7.7 2.9.7c2.5 0 5.3-4.1 5.3-8.1 0-2.9-1.5-5.2-3.8-5.2z" />
      <path d="M12 8.2c0-2.3.9-4.2 2.4-5.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13.2 5.4c1.4-1.7 3.4-2 4.8-1.6-.4 1.8-2.3 3-4.8 1.6z" />
    </svg>
  );
}
