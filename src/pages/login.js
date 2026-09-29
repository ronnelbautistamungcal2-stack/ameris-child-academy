import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import AmerisLogo from "@/components/ui/AmerisLogo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
    <div className="relative min-h-screen overflow-hidden bg-slate-100 dark:bg-gray-950">
      {/* Background photo: children climbing the steps toward the pillar */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-[position:22%_center] dark:brightness-[0.55]"
          style={{ backgroundImage: "url('/uploads/Home_Page_Picture.png')" }}
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white/90 to-transparent dark:from-gray-950/90" />
      </div>

      <main className="relative z-10 flex min-h-screen items-center px-4 py-10 sm:px-8">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_440px] lg:gap-16">
          {/* Logo */}
          <Link
            href="/"
            className="mx-auto block w-[min(260px,70vw)] lg:mx-0 lg:-mt-56 lg:w-[500px]"
            aria-label="Ameris Academy home"
          >
            <AmerisLogo
              size="xl"
              showTagline
              className="drop-shadow-[0_2px_12px_rgba(255,255,255,0.85)]"
              style={{ width: "100%" }}
            />
          </Link>

          {/* Login card */}
          <div className="w-full max-w-[440px] justify-self-center rounded-3xl border border-white/70 bg-white/95 p-8 shadow-2xl shadow-slate-900/20 backdrop-blur animate-[modalIn_0.4s_ease-out] sm:p-10 lg:justify-self-end dark:border-gray-700 dark:bg-gray-900/90">
            <div className="text-center">
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Welcome back</h1>
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

          </div>
        </div>
      </main>
    </div>
  );
}
