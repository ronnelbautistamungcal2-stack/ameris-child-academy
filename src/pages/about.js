import Image from "next/image";
import PublicLayout from "@/components/public/PublicLayout";

// Staff headshots live in /public/about/team/. Leave `photo` null until one is
// supplied and the card shows the person's initials instead.
const TEAM = [
  {
    name: "Bonnie Kingston",
    photo: null,
    bio: "Bonnie has over 14 years of experience in early childhood education and a passion for supporting children, families, and staff. She holds a Bachelor's degree in Accounting and Finance and a CDA credential.",
  },
  {
    name: "Jessica Palmer",
    photo: null,
    bio: "Jessica loves working with young children and believes in the power of positive relationships. She enjoys creating fun, hands-on learning opportunities that help each child feel valued and capable.",
  },
  {
    name: "Sarah Mitchell",
    photo: null,
    bio: "Sarah loves creating a warm and engaging environment where children feel safe and supported. She enjoys planning hands-on activities that spark curiosity and a love for learning.",
  },
  {
    name: "Hannah Brooks",
    photo: null,
    bio: "Hannah has a gentle and caring way with our youngest learners. She enjoys helping infants and toddlers explore, learn, and reach important milestones every day.",
  },
  {
    name: "Emily Carter",
    photo: null,
    bio: "Emily has a passion for working with school-age children. She enjoys helping kids build confidence, develop friendships, and discover their unique talents through fun and meaningful experiences.",
  },
  {
    name: "Laura Jensen",
    photo: null,
    bio: "Laura prepares healthy and nutritious meals and snacks for our children. She loves knowing that the food she prepares helps fuel their growth, energy, and learning throughout the day.",
  },
  {
    name: "Michael Reed",
    photo: null,
    bio: "Michael keeps our facility safe, clean, and welcoming for our children, families, and staff. He takes pride in making sure everything runs smoothly so our children can thrive in a positive environment.",
  },
  {
    name: "Rachel Adams",
    photo: null,
    bio: "Rachel supports our children and families by keeping things organized and running smoothly. She enjoys helping parents, coordinating programs, and being a friendly face at the front desk.",
  },
];

export default function AboutPage() {
  return (
    <PublicLayout
      title="About Us"
      description="Ameris Academy is a nonprofit early childhood development center in West Valley City, Utah, serving children and families since 2015."
    >
      <div className="bg-white pb-28 pt-28 font-serif text-[#1d2352] sm:pt-32">
        <IntroSection />
        <SectionDivider />
        <TeamSection />
      </div>
    </PublicLayout>
  );
}

function IntroSection() {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-6 lg:px-10">
      <div className="grid items-start gap-8 md:grid-cols-[0.95fr_1.05fr] lg:gap-12">
        <div>
          <h1 className="text-[clamp(2.75rem,6vw,4.25rem)] font-bold leading-none tracking-tight text-[#1b3f8f]">
            About Us
          </h1>
          <div className="mt-3 flex max-w-[420px] items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-[#9dbde6]" />
            <HeartIcon className="h-5 w-5 text-[#ec8fa9]" />
            <span className="h-px flex-1 bg-[#9dbde6]" />
          </div>

          <div className="mt-6 space-y-4 text-[15px] leading-7 text-slate-800">
            <p>
              We chose the name Ameris because we wanted our name to reflect the heart of what we
              do. Ameris means &ldquo;loved ones&rdquo; and &ldquo;blessed by God,&rdquo;
              representing our belief that every child is a blessing with unique potential.
            </p>
            <p>
              Ameris Academy is a nonprofit early childhood development center in West Valley
              City, Utah, serving children and families since 2015. Our purpose is to provide
              children with meaningful experiences in education, character, and practical life
              skills that build a strong foundation for their future.
            </p>
            <p>
              Through quality care, a loving environment, and character training, we nurture
              children as they learn, build confidence, develop strong values, and prepare to
              become pillars in their families and communities.
            </p>
          </div>
        </div>

        <div className="relative aspect-[638/377] w-full overflow-hidden rounded-[18px] shadow-[0_24px_50px_-36px_rgba(27,58,109,0.6)]">
          <Image
            src="/about/building.png"
            alt="The Ameris Academy building in West Valley City, Utah"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 55vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}

function SectionDivider() {
  return (
    <div className="mx-auto mt-12 flex w-full max-w-[1200px] items-center gap-4 px-6 lg:px-10" aria-hidden="true">
      <span className="h-[2px] flex-1 bg-[#8fb6e3]" />
      <span className="flex items-end gap-1">
        <LeafIcon className="h-5 w-5 -scale-x-100 text-[#7fb447]" />
        <HeartIcon className="h-6 w-6 text-[#ec8fa9]" />
        <LeafIcon className="h-5 w-5 text-[#7fb447]" />
      </span>
      <span className="h-[2px] flex-1 bg-[#8fb6e3]" />
    </div>
  );
}

function TeamSection() {
  return (
    <section className="relative mx-auto mt-6 w-full max-w-[1200px] px-6 lg:px-10">
      <h2 className="text-[clamp(2.25rem,4.5vw,3.25rem)] font-bold leading-none tracking-tight text-[#1b3f8f]">
        Our Team
      </h2>

      <ul className="mt-8 grid gap-x-12 gap-y-7 md:grid-cols-2">
        {TEAM.map((member) => (
          <li key={member.name} className="flex gap-5">
            <TeamPhoto member={member} />
            <div className="min-w-0">
              <h3 className="text-[1.3rem] font-bold leading-tight text-[#1b3f8f]">{member.name}</h3>
              <p className="mt-1.5 text-[14px] leading-6 text-[#2c3f7a]">{member.bio}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="pointer-events-none absolute -bottom-16 right-6 hidden items-end gap-1 md:flex lg:right-10" aria-hidden="true">
        <HeartIcon className="mb-4 h-6 w-6 text-[#ec8fa9]" />
        <LeafIcon className="h-12 w-12 text-[#7fb447]" />
      </div>
    </section>
  );
}

function TeamPhoto({ member }) {
  const initials = member.name
    .split(" ")
    .map((part) => part[0])
    .join("");

  return (
    <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-[10px] bg-gradient-to-br from-[#e6eefb] to-[#f7e7ee] shadow-[0_14px_30px_-24px_rgba(27,58,109,0.7)] sm:h-[120px] sm:w-[120px]">
      {member.photo ? (
        <Image src={member.photo} alt={member.name} fill sizes="120px" className="object-cover object-top" />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-3xl font-bold text-[#1b3f8f]/70">
          {initials}
        </span>
      )}
    </div>
  );
}

function HeartIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2 3.6 0 5.7 3.8 4.2 7.2C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function LeafIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M4 20c0-9 6-15 16-16-1 10-7 16-16 16z" />
      <path d="M4 20c4-5 8-9 12-12" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
    </svg>
  );
}
