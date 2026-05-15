import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { MoonIcon, SunIcon } from "@/components/public/icons";
import AmerisLogo from "@/components/ui/AmerisLogo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const callbackUrlRaw = router.query?.callbackUrl;
  const callbackUrl =
    typeof callbackUrlRaw === "string"
      ? callbackUrlRaw
      : Array.isArray(callbackUrlRaw)
        ? callbackUrlRaw[0]
        : null;

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 8000);
    return () => clearTimeout(timer);
  }, [error]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });
      if (res && !res.error) {
        router.replace(callbackUrl || "/dashboard");
      } else {
        setError(
          res?.error === "CredentialsSignin"
            ? "Invalid email or password. Please try again."
            : res?.error === "AUTH_SERVICE_UNAVAILABLE"
              ? "Authentication service is unavailable. Check the database connection and seed data."
              : res?.error || "Login failed. Please try again.",
        );
      }
    } catch (err) {
      setError(err?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-gray-950">
      {/* Background decoration */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-blue-200/50 blur-2xl dark:bg-blue-900/30" />
        <div className="absolute -bottom-24 left-0 h-[420px] w-[420px] rounded-full bg-sky-200/40 blur-2xl dark:bg-sky-900/20" />
        <div className="absolute -bottom-24 right-0 h-[420px] w-[420px] rounded-full bg-amber-200/30 blur-2xl dark:bg-amber-900/20" />
        <div className="absolute left-10 top-28 h-10 w-28 rounded-full bg-white/70 shadow-sm dark:bg-gray-800/50" />
        <div className="absolute left-36 top-20 h-8 w-20 rounded-full bg-white/70 shadow-sm dark:bg-gray-800/50" />
        <div className="absolute right-24 top-24 h-10 w-28 rounded-full bg-white/70 shadow-sm dark:bg-gray-800/50" />
        <div className="absolute right-44 top-16 h-8 w-20 rounded-full bg-white/70 shadow-sm dark:bg-gray-800/50" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center">
            <AmerisLogo size="md" showText={false} />
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <Link
              href="/signup"
              className="text-sm font-semibold text-blue-800 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 px-6 pb-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_460px_1fr]">
          {/* Left illustration */}
          <div className="hidden lg:block">
            <LeftIllustration />
          </div>

          {/* Login card */}
          <div className="rounded-3xl border border-gray-200 bg-white/90 p-8 shadow-sm backdrop-blur animate-[modalIn_0.4s_ease-out] dark:border-gray-700 dark:bg-gray-900/90">
            <div className="text-center">
              <AmerisLogo size="lg" showText={false} className="mx-auto drop-shadow-sm" />
              <h1 className="mt-4 text-2xl font-extrabold text-gray-900 dark:text-gray-100">Welcome back</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Sign in to your Ameris Academy account
              </p>
            </div>

            {error && (
              <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800 animate-[toastIn_0.25s_ease-out]">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-red-500">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Email Address
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 dark:text-gray-500">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 6l-10 7L2 6" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full rounded-2xl border border-gray-200 py-3 pl-12 pr-4 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-600 dark:focus:ring-blue-600"
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Password
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 dark:text-gray-500">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full rounded-2xl border border-gray-200 py-3 pl-12 pr-12 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-600 dark:focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      {showPassword ? (
                        <>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.59" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.88 5.09A10.94 10.94 0 0112 5c7 0 10 7 10 7a18.9 18.9 0 01-4.33 5.33" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.61 6.61A18.9 18.9 0 002 12s3 7 10 7c1.08 0 2.1-.15 3.05-.43" />
                        </>
                      ) : (
                        <>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-800 to-sky-600 px-4 py-3 text-sm font-extrabold text-white transition-all hover:from-blue-900 hover:to-sky-700 hover:shadow-lg hover:shadow-blue-800/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-semibold text-blue-800 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                Create one
              </Link>
            </div>

            {/* Portal quick links */}
            <div className="mt-6 border-t border-gray-200 pt-5 dark:border-gray-700">
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Portal Access
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  { label: "Parents", color: "bg-sky-50 text-sky-700" },
                  { label: "Teachers", color: "bg-emerald-50 text-emerald-700" },
                  { label: "Other Staff", color: "bg-cyan-50 text-cyan-700" },
                  { label: "Coaches", color: "bg-indigo-50 text-indigo-700" },
                  { label: "Admin", color: "bg-blue-50 text-blue-800" },
                ].map((portal) => (
                  <div
                    key={portal.label}
                    className={`rounded-2xl ${portal.color} px-3 py-2 text-center text-xs font-semibold`}
                  >
                    {portal.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Dev-only demo credentials */}
            {process.env.NODE_ENV !== "production" && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Demo Credentials
                </p>
                <div className="mt-2 space-y-1.5 text-xs text-amber-800">
                  {[
                    { role: "Admin", email: "admin@demo.com", pw: "adminpass" },
                    { role: "Teacher", email: "teacher@demo.com", pw: "teacherpass" },
                    { role: "Other Staff", email: "otherstaff@demo.com", pw: "otherstaffpass" },
                    { role: "Parent", email: "parent@demo.com", pw: "parentpass" },
                    { role: "Coach", email: "coach@demo.com", pw: "coachpass" },
                  ].map((cred) => (
                    <button
                      key={cred.role}
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left transition hover:bg-amber-100"
                      onClick={() => {
                        setEmail(cred.email);
                        setPassword(cred.pw);
                      }}
                    >
                      <span className="font-semibold">{cred.role}</span>
                      <span className="text-amber-600">{cred.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right illustration */}
          <div className="hidden lg:block">
            <RightIllustration />
          </div>
        </div>
      </main>
    </div>
  );
}

/* Illustrations */

function LeftIllustration() {
  return (
    <div className="relative mx-auto max-w-xs">
      <div className="rounded-[48px] bg-white/60 p-8 shadow-sm backdrop-blur dark:bg-gray-800/60">
        <svg viewBox="0 0 200 200" className="h-auto w-full">
          {/* Building blocks / daycare */}
          <rect x="30" y="120" width="140" height="60" rx="12" fill="#BFDBFE" />
          <rect x="50" y="90" width="100" height="50" rx="10" fill="#93C5FD" />
          <rect x="70" y="65" width="60" height="40" rx="8" fill="#3B82F6" />
          {/* Roof */}
          <polygon points="100,40 55,68 145,68" fill="#1E3A8A" />
          {/* Door */}
          <rect x="85" y="140" width="30" height="40" rx="4" fill="#EFF6FF" />
          {/* Windows */}
          <rect x="55" y="130" width="18" height="18" rx="3" fill="#EFF6FF" />
          <rect x="127" y="130" width="18" height="18" rx="3" fill="#EFF6FF" />
          <rect x="70" y="100" width="18" height="18" rx="3" fill="#EFF6FF" />
          <rect x="112" y="100" width="18" height="18" rx="3" fill="#EFF6FF" />
          {/* Sun */}
          <circle cx="165" cy="35" r="16" fill="#FCD34D" />
          <circle cx="165" cy="35" r="10" fill="#FBBF24" />
        </svg>
        <p className="mt-4 text-center text-sm font-semibold text-gray-600 dark:text-gray-300">
          Nurturing young minds since 2015
        </p>
      </div>
    </div>
  );
}

function RightIllustration() {
  return (
    <div className="relative mx-auto max-w-xs">
      <div className="rounded-[48px] bg-white/60 p-8 shadow-sm backdrop-blur dark:bg-gray-800/60">
        <svg viewBox="0 0 200 200" className="h-auto w-full">
          {/* Graduation cap scene */}
          <circle cx="100" cy="105" r="50" fill="#A7F3D0" />
          <circle cx="100" cy="95" r="30" fill="#0F172A" />
          {/* Eyes */}
          <circle cx="88" cy="90" r="4" fill="#fff" />
          <circle cx="112" cy="90" r="4" fill="#fff" />
          {/* Smile */}
          <path d="M90 103c4 6 16 6 20 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          {/* Graduation cap */}
          <polygon points="100,58 60,75 100,85 140,75" fill="#1E293B" />
          <rect x="97" y="55" width="6" height="12" rx="1" fill="#1E293B" />
          <line x1="140" y1="75" x2="140" y2="92" stroke="#1E293B" strokeWidth="2" />
          <circle cx="140" cy="94" r="3" fill="#FBBF24" />
          {/* Stars */}
          <polygon points="45,40 47,46 53,46 48,50 50,56 45,52 40,56 42,50 37,46 43,46" fill="#FCD34D" />
          <polygon points="160,50 161.5,54 166,54 162.5,57 164,61 160,58 156,61 157.5,57 154,54 158.5,54" fill="#FCD34D" />
          <polygon points="50,150 51.5,154 56,154 52.5,157 54,161 50,158 46,161 47.5,157 44,154 48.5,154" fill="#FCD34D" />
        </svg>
        <p className="mt-4 text-center text-sm font-semibold text-gray-600 dark:text-gray-300">
          Every child deserves a brighter beginning
        </p>
      </div>
    </div>
  );
}
