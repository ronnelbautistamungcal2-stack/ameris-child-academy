import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import PublicLayout from "@/components/public/PublicLayout";
import { StarIcon, PlayIcon, ArrowRightIcon } from "@/components/public/icons";

const FEATURE_PILLARS = [
  {
    title: "Safe & Loving Environment",
    description:
      "Every child's safety, happiness, and well-being are our highest priorities.",
    imageSrc: "/homepage-assets/image_14.webp",
    imageAlt: "Safe and loving environment icon",
  },
  {
    title: "Learning Through Growth",
    description:
      "Age-appropriate academics and social development for every stage.",
    imageSrc: "/homepage-assets/image_15.webp",
    imageAlt: "Learning through growth icon",
  },
  {
    title: "Character & Confidence",
    description: "Building kindness, teamwork, and leadership every day.",
    imageSrc: "/homepage-assets/image_16.webp",
    imageAlt: "Character and confidence icon",
  },
  {
    title: "Fun Indoor & Outdoor Play",
    description:
      "Interactive play, sports, and creative activities children love.",
    imageSrc: "/homepage-assets/image_17.webp",
    imageAlt: "Fun indoor and outdoor play icon",
  },
  {
    title: "Healthy Fresh Nutrition",
    description:
      "Fresh vegetables grown in our own organic greenhouse system for healthier children.",
    imageSrc: null,
    imageAlt: "Healthy fresh nutrition icon",
  },
];

const PROGRAMS = [
  {
    title: "Infants",
    description: "Personalized love and care in a safe, trusting environment.",
    ageRange: "1 - 12 months",
    imageSrc: "/homepage-assets/Infants.webp",
    imagePosition: "center center",
    badgeImageSrc: "/homepage-assets/image_19.webp",
    badgeImageAlt: "Infants icon",
  },
  {
    title: "Toddlers",
    description:
      "Exploring, discovering, and building confidence through play and hands-on learning.",
    ageRange: "1 - 2 years",
    imageSrc: "/homepage-assets/Toddlers.webp",
    imagePosition: "center center",
    badgeImageSrc: "/homepage-assets/image_20.webp",
    badgeImageAlt: "Toddlers icon",
  },
  {
    title: "Pre-K",
    description:
      "Building confidence, character, and preparing for school and beyond.",
    ageRange: "3 - 5 years",
    imageSrc: "/homepage-assets/Pre-K.webp",
    imagePosition: "center center",
    badgeImageSrc: "/homepage-assets/image_21.webp",
    badgeImageAlt: "Pre-K icon",
  },
  {
    title: "School Age",
    description:
      "Leadership, life skills, academic support, and fun that inspires growth.",
    ageRange: "5 - 12 years",
    imageSrc: "/homepage-assets/New_School_Age.webp",
    imagePosition: "center center",
    badgeImageSrc: "/homepage-assets/image_22.webp",
    badgeImageAlt: "School age icon",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "I love that when my kids get there each morning my teacher gives them a big smile and says hi with their names. Thank you for all the heart you put into each day.",
    author: "Jennie",
  },
  {
    quote:
      "I really like that every activity and lesson is catered to their age. I don't ever have to worry about my kids not being included in class activities.",
    author: "Helen",
  },
  {
    quote:
      "I love that the children have the opportunity to help in the gardens and enjoy healthy meals and snacks made with fresh vegetables grown right on site.",
    author: "Carolyn",
  },
];

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
      description="Turning Today's Blessings into Tomorrow's Pillars at Ameris Academy."
    >
      <div className="pb-20">
        <HeroSection />
        <div className="relative bg-white pt-8">
          <FeatureSection />
          <ProgramsSection />
          <AboutSection />
          <TestimonialsSection />
        </div>
      </div>
    </PublicLayout>
  );
}

function HeroSection() {
  const videoRef = useRef(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState("16 / 9");

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    void video.play();
    setHasStarted(true);
  };

  const handleLoadedMetadata = (event) => {
    const { videoWidth, videoHeight } = event.currentTarget;
    if (!videoWidth || !videoHeight) return;
    setVideoAspectRatio(`${videoWidth} / ${videoHeight}`);
  };

  return (
    <section className="relative pb-24 pt-32 sm:pb-28 sm:pt-36">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/homepage-assets/Image_Top.webp"
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover object-center"
        />
      </div>

      <div className="relative mx-auto w-full px-5 lg:px-8">
        <div className="grid items-center gap-8 md:grid-cols-[0.42fr_0.58fr] lg:gap-10">
          <div className="mx-auto max-w-[360px] text-center md:mx-0 md:pl-8">
            <h1 className="text-[clamp(2rem,3.5vw,3.3rem)] font-extrabold leading-[1.08] tracking-tight text-[#1d2352]">
              Turning Today&apos;s Blessings into Tomorrow&apos;s Pillars
            </h1>
          </div>

          <div className="relative md:justify-self-end md:w-full md:max-w-[760px]">
            <div className="rounded-[28px] bg-[#dddde4]/88 p-3 shadow-[0_24px_56px_-42px_rgba(27,58,109,0.65)] ring-1 ring-white/70 backdrop-blur">
              <div
                className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#ececef_0%,#e4e4ea_100%)]"
                style={{ aspectRatio: videoAspectRatio }}
              >
                <video
                  ref={videoRef}
                  className={`absolute inset-0 h-full w-full object-cover transition ${hasStarted ? "opacity-100" : "opacity-0"}`}
                  src="/home-video.mp4"
                  playsInline
                  preload="metadata"
                  controls={hasStarted}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setHasStarted(false)}
                />

                <div className={`absolute inset-0 transition ${hasStarted ? "pointer-events-none opacity-0" : "opacity-100"}`}>
                  <div className="absolute inset-x-[16%] inset-y-[22%]">
                    <div className="relative h-full w-full">
                      <Image
                        src="/ameris-logo-transparent.png"
                        alt="Ameris Academy logo"
                        fill
                        sizes="(max-width: 768px) 80vw, 34rem"
                        className="object-contain"
                        priority
                      />
                    </div>
                  </div>
                </div>

                {!hasStarted && (
                  <button
                    type="button"
                    onClick={handlePlay}
                    className="absolute inset-0 z-10 grid place-items-center text-[#2a69ba]"
                    aria-label="Play video"
                  >
                    <span className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/90 shadow-[0_20px_40px_-28px_rgba(25,56,143,0.95)] ring-2 ring-[#7fd0f1]/70 transition hover:scale-105">
                      <PlayIcon className="ml-1 h-9 w-9" />
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Asymmetric wave — peaks on the left, slopes down to the right */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden leading-none">
        <svg
          viewBox="0 0 1440 90"
          preserveAspectRatio="none"
          className="block w-full"
          style={{ height: "90px" }}
          aria-hidden="true"
        >
          <path
            d="M0,90 L0,42 C120,6 280,58 520,38 C720,22 980,60 1250,48 C1340,44 1400,52 1440,58 L1440,90 Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}

function FeatureSection() {
  return (
    <section className="py-8">
      <div className="mx-auto w-full px-6 lg:px-10">
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-5">
          {FEATURE_PILLARS.map((item) => (
            <article key={item.title} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center">
                {item.imageSrc ? (
                  <Image
                    src={item.imageSrc}
                    alt={item.imageAlt}
                    width={56}
                    height={56}
                    className="h-14 w-14 object-contain"
                  />
                ) : (
                  <LeafIcon className="h-10 w-10 text-[#3c9f48]" />
                )}
              </div>
              <h2 className="mt-2.5 text-[1rem] font-extrabold leading-tight text-[#1d2352]">
                {item.title}
              </h2>
              <p className="mt-2 text-[12px] leading-6 text-slate-600">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProgramsSection() {
  return (
    <section className="bg-white pt-10">
      <div className="mx-auto w-full px-6 lg:px-10">
        <h2 className="text-center text-[1.85rem] font-extrabold tracking-tight text-[#1d2352]">
          Programs for Every Age &amp; Stage
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {PROGRAMS.map((program) => (
            <article
              key={program.title}
              className="overflow-hidden rounded-[18px] bg-white shadow-[0_22px_44px_-40px_rgba(27,58,109,0.5)] ring-1 ring-slate-200/70"
            >
              <div className="relative aspect-[15/10] overflow-hidden">
                <Image
                  src={program.imageSrc}
                  alt={program.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                  className="object-cover"
                  style={{ objectPosition: program.imagePosition }}
                />
                <span className="absolute bottom-2.5 left-2.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 p-0.5 shadow-lg">
                  <Image
                    src={program.badgeImageSrc}
                    alt={program.badgeImageAlt}
                    width={46}
                    height={46}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                </span>
              </div>
              <div className="px-4 pb-4 pt-3 text-center">
                <h3 className="text-[1.05rem] font-extrabold text-[#1d2352]">{program.title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-slate-600">{program.description}</p>
                <div className="mt-4 text-[13px] font-bold text-slate-500">{program.ageRange}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section className="pt-10">
      <div className="mx-auto w-full px-6 lg:px-10">
        <div className="relative overflow-hidden rounded-[22px] p-4 shadow-[0_20px_50px_-42px_rgba(27,58,109,0.35)] ring-1 ring-white/90">
          <div className="pointer-events-none absolute inset-0">
            <Image
              src="/homepage-assets/Image_Middle.webp"
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-center"
            />
          </div>
          <div className="grid items-center gap-4 md:grid-cols-[1fr_1.03fr]">
            <div className="relative overflow-hidden rounded-[18px] bg-white/88 shadow-[0_18px_40px_-34px_rgba(27,58,109,0.35)]">
              <div className="relative aspect-[16/10]">
                <Image
                  src="/homepage-assets/Building_Foundations.webp"
                  alt="Children learning together"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                  style={{ objectPosition: "center center" }}
                />
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[18px] bg-white/82 px-5 py-5 shadow-[0_18px_40px_-34px_rgba(27,58,109,0.25)]">
              <div className="absolute bottom-0 right-2 hidden h-28 w-20 text-[#7fb447] md:block">
                <TreeIllustration />
              </div>
              <div className="relative max-w-none">
                <div className="text-[12px] font-black uppercase tracking-[0.18em] text-[#5b9a2e]">
                  About Us
                </div>
                <h2 className="mt-2 text-[2rem] font-extrabold leading-tight tracking-tight text-[#1d2352]">
                  Building Foundations for a Bright Future
                </h2>
                <p className="mt-4 text-[13px] leading-7 text-slate-700">
                  At Ameris Academy, we believe every child is a blessing. Through quality
                  teaching, character training, and a loving environment, we help children grow
                  academically, socially, and emotionally while preparing them to become the
                  pillars of tomorrow.
                </p>
                <div className="mt-5">
                  <Link
                    href="/about"
                    className="inline-flex items-center gap-2 rounded-[12px] bg-[#19388f] px-5 py-3 text-[13px] font-extrabold text-white transition hover:bg-[#163179]"
                  >
                    Learn More About Us
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="pt-4 pb-10">
      <div className="mx-auto w-full px-6 lg:px-10">
        <h2 className="text-center text-[1.85rem] font-extrabold tracking-tight text-[#1d2352]">
          What Parents Are Saying
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((item) => (
            <article
              key={item.author}
              className="rounded-[18px] bg-white px-4 py-5 shadow-[0_20px_44px_-38px_rgba(27,58,109,0.5)] ring-1 ring-slate-200/70"
            >
              <QuoteIcon className="h-7 w-7 text-[#1d2f87]" />
              <p className="mt-3 text-[13px] leading-7 text-slate-700">{item.quote}</p>
              <div className="mt-4 text-[13px] font-black text-[#1d2352]">-{item.author}</div>
              <div className="mt-3 flex gap-1 text-[#f0b324]">
                {Array.from({ length: 5 }).map((_, index) => (
                  <StarIcon key={`${item.author}-${index}`} className="h-4 w-4 fill-current stroke-current" />
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuoteIcon({ className = "h-8 w-8" }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
      <path d="M14 7C8.477 7 4 11.477 4 17v8h10v-8H9.13A5.004 5.004 0 0114 12V7zm14 0c-5.523 0-10 4.477-10 10v8h10v-8h-4.87A5.004 5.004 0 0128 12V7z" />
    </svg>
  );
}

function LeafIcon({ className = "h-9 w-9" }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 28c0-10.493 8.507-19 19-19h5v5c0 13.255-10.745 24-24 24h-1v-10z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 32c4-7 9.5-12.5 17-17" />
    </svg>
  );
}

function TreeIllustration() {
  return (
    <svg viewBox="0 0 140 220" className="h-full w-full" fill="none" aria-hidden="true">
      <path d="M67 210c0-39 7-69 18-97H54c9 28 13 58 13 97z" fill="#8b5a31" />
      <ellipse cx="71" cy="210" rx="32" ry="8" fill="#9cc56b" opacity="0.5" />
      <circle cx="67" cy="65" r="42" fill="#9fcf4e" />
      <circle cx="43" cy="90" r="31" fill="#a9d75c" />
      <circle cx="92" cy="92" r="28" fill="#8bc34a" />
      <circle cx="82" cy="48" r="24" fill="#a6d962" />
      <circle cx="47" cy="55" r="22" fill="#8ebd44" />
    </svg>
  );
}
