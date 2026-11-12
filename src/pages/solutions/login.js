import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import SolutionsLayout, { BTN, NAVY } from "@/components/solutions/SolutionsLayout";

// Ameris Solutions login (client sheet 10-29, row 39 mockup): the website's
// header, a classroom background and the Login card. Same sign-in as /login.
// There's no password-reset email yet, so Forgot Password? goes to Contact Us.

const REMEMBER_KEY = "amerisSolutions.rememberEmail";

function readRemembered() {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) || "";
  } catch {
    return "";
  }
}

function writeRemembered(email) {
  try {
    if (email) window.localStorage.setItem(REMEMBER_KEY, email);
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* storage blocked: nothing to remember */
  }
}

const FIELD =
  "w-full rounded-xl border border-gray-300 bg-white py-3 pl-12 pr-12 text-base text-gray-900 placeholder:text-gray-500 focus:border-[#0b2a5b] focus:outline-none focus:ring-2 focus:ring-blue-100";

function FieldIcon({ d }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-[#0b2a5b]">
      <path d={d} />
    </svg>
  );
}

export default function SolutionsLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const callbackRaw = router.query?.callbackUrl;
  const callbackUrl = typeof callbackRaw === "string" ? callbackRaw : Array.isArray(callbackRaw) ? callbackRaw[0] : "";

  useEffect(() => {
    const saved = readRemembered();
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  useEffect(() => {
    if (router.query?.error === "AccountDisabled") setError("Your account has been disabled. Please contact your administrator.");
  }, [router.query?.error]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", { redirect: false, email: email.trim(), password });
      if (res && !res.error) {
        writeRemembered(remember ? email.trim() : "");
        // Only same-site paths, never an outside address.
        router.replace(callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/dashboard");
        return;
      }
      setError(
        res?.error === "CredentialsSignin"
          ? "Invalid email or password. Please try again."
          : res?.error === "AUTH_SERVICE_UNAVAILABLE"
            ? "Sign-in is unavailable right now. Please try again in a moment."
            : res?.error || "Login failed. Please try again.",
      );
    } catch (err) {
      setError(err?.message || "Login failed. Please try again.");
    }
    setLoading(false);
  }

  return (
    <SolutionsLayout title="Login" hideQuoteButton={false}>
      <section className="relative -mt-2 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-60"
          style={{ backgroundImage: "url('/solutions/warm-preschool-classroom-with-teddy-bear.jpg')" }}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/40 to-sky-50/80" />
        <div className="relative mx-auto flex max-w-6xl justify-center px-4 py-12 sm:py-16">
          <form onSubmit={handleSubmit} className="w-full max-w-xl rounded-[2rem] border border-blue-100 bg-white/95 px-6 py-10 shadow-lg sm:px-10" noValidate>
            <h1 className={`text-center font-serif text-5xl font-bold ${NAVY}`}>Login</h1>
            <p className="mt-3 text-center text-lg text-gray-700">Access your Ameris Solutions account.</p>

            <div className="mt-8 space-y-4">
              <label className="relative block">
                <span className="sr-only">Username or Email</span>
                <FieldIcon d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0" />
                <input type="email" className={FIELD} placeholder="Username or Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
              </label>
              <label className="relative block">
                <span className="sr-only">Password</span>
                <FieldIcon d="M7 11V8a5 5 0 0110 0v3M6 11h12v9H6zM12 15v2" />
                <input type={show ? "text" : "password"} className={FIELD} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#0b2a5b] hover:bg-blue-50"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                    {show ? null : <path d="M4 4l16 16" />}
                  </svg>
                </button>
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <label className={`flex items-center gap-2 font-semibold ${NAVY}`}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 rounded border-gray-400" />
                Remember Me
              </label>
              <Link href="/solutions/contact" className="font-semibold text-blue-700 underline hover:text-blue-900">
                Forgot Password?
              </Link>
            </div>

            {error ? (
              <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={loading} className={`${BTN} mt-6 w-full py-3 text-lg disabled:opacity-60`}>
              {loading ? "Signing in..." : "Log In"}
            </button>
          </form>
        </div>
      </section>
    </SolutionsLayout>
  );
}
