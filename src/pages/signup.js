import Link from "next/link";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

export default function Signup() {
  const router = useRouter();

  const modeFromQuery = useMemo(() => {
    const t = router.query?.type;
    if (t === "staff") return "staff";
    return "parent";
  }, [router.query?.type]);

  const [mode, setMode] = useState(modeFromQuery);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteStatus, setInviteStatus] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMode(modeFromQuery);
  }, [modeFromQuery]);

  const title =
    mode === "staff" ? "Join Existing School Account" : "Create account as parent";

  const normalizedCode = useMemo(() => {
    return inviteCode.trim().replace(/\s+/g, "").toUpperCase();
  }, [inviteCode]);

  async function verifyInvite() {
    setInviteStatus(null);
    const code = normalizedCode;
    if (!code) return;
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/v1/invites/verify?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      setInviteStatus(data);
    } catch {
      setInviteStatus({ valid: false });
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const code = normalizedCode;
    if (!code) {
      setError("Invite code is required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    const name =
      mode === "staff"
        ? fullName.trim()
        : `${firstName.trim()} ${lastName.trim()}`.trim();

    if (!name) {
      setError("Name is required.");
      return;
    }

    setLoading(true);
    try {
      const createRes = await fetch("/api/v1/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          inviteCode: code,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        setError(err.error || "Failed to create account.");
        setLoading(false);
        return;
      }

      const signInRes = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      setLoading(false);

      if (signInRes && !signInRes.error) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    } catch (err) {
      setError(err?.message || "An error occurred.");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <BackgroundScene />

      <header className="relative z-10 px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-100 text-sm font-extrabold text-sky-700">
              ACA
            </div>
            <div>
              <div className="text-sm font-extrabold text-gray-900">
                Ameris Academy
              </div>
              <div className="text-xs text-gray-500">Childcare</div>
            </div>
          </div>
          <Link
            href="/login"
            className="text-sm font-semibold text-sky-700 hover:text-sky-800"
          >
            Log in
          </Link>
        </div>
      </header>

      <main className="relative z-10 px-6 pb-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_520px_1fr]">
          <div className="hidden lg:block" />

          <div className="rounded-3xl border border-gray-200 bg-white/90 p-8 shadow-sm backdrop-blur">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800"
            >
              <span aria-hidden="true">←</span> Back
            </Link>

            <h1 className="mt-5 text-center text-2xl font-extrabold text-gray-900">
              {title}
            </h1>

            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode("parent")}
                className={[
                  "rounded-2xl px-3 py-2 text-sm font-extrabold transition",
                  mode === "parent"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-800",
                ].join(" ")}
              >
                Parent
              </button>
              <button
                type="button"
                onClick={() => setMode("staff")}
                className={[
                  "rounded-2xl px-3 py-2 text-sm font-extrabold transition",
                  mode === "staff"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-800",
                ].join(" ")}
              >
                Staff
              </button>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === "staff" ? (
                <Field label="Name">
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm"
                    placeholder="Name"
                    required
                    autoComplete="name"
                  />
                </Field>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="First Name">
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm"
                      placeholder="Jane"
                      required
                      autoComplete="given-name"
                    />
                  </Field>
                  <Field label="Last Name">
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm"
                      placeholder="Doe"
                      required
                      autoComplete="family-name"
                    />
                  </Field>
                </div>
              )}

              <Field label="Invite Code">
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onBlur={verifyInvite}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-mono tracking-wide"
                  placeholder="Invite Code"
                  required
                />
                <div className="mt-2 text-xs">
                  {inviteLoading ? (
                    <span className="text-gray-500">Checking code...</span>
                  ) : inviteStatus?.valid ? (
                    <span className="font-semibold text-green-700">
                      Code accepted · {inviteStatus.centerName || "Center"} ·{" "}
                      {inviteStatus.role}
                    </span>
                  ) : inviteStatus && inviteStatus.valid === false ? (
                    <span className="font-semibold text-red-700">
                      Invalid invite code
                    </span>
                  ) : (
                    <span className="text-gray-500">
                      Ask your center admin for an invite code.
                    </span>
                  )}
                </div>
              </Field>

              <Field label="Email Address">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm"
                  placeholder="example@example.com"
                  required
                  autoComplete="email"
                />
              </Field>

              <Field label={mode === "staff" ? "Create a Password" : "Password"}>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  show={showPassword}
                  setShow={setShowPassword}
                />
              </Field>

              <Field label="Confirm Password">
                <PasswordInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  show={showConfirmPassword}
                  setShow={setShowConfirmPassword}
                />
              </Field>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-full bg-sky-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing up..." : "Sign Up"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              I already have an account.{" "}
              <Link href="/login" className="font-semibold text-sky-700 hover:text-sky-800">
                Log in
              </Link>
            </div>
          </div>

          <div className="hidden lg:block">
            <RightIllustration />
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      {children}
    </label>
  );
}

function PasswordInput({ value, onChange, show, setShow }) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-gray-200 px-4 py-3 pr-12 text-sm"
        placeholder="Password"
        required
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 hover:text-gray-700"
        aria-label={show ? "Hide password" : "Show password"}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          {show ? (
            <>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3l18 18"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.59"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.88 5.09A10.94 10.94 0 0112 5c7 0 10 7 10 7a18.9 18.9 0 01-4.33 5.33"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.61 6.61A18.9 18.9 0 002 12s3 7 10 7c1.08 0 2.1-.15 3.05-.43"
              />
            </>
          ) : (
            <>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15a3 3 0 100-6 3 3 0 000 6z"
              />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}

function BackgroundScene() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-sky-200/50 blur-2xl" />
      <div className="absolute -bottom-24 left-0 h-[420px] w-[420px] rounded-full bg-emerald-200/40 blur-2xl" />
      <div className="absolute -bottom-24 right-0 h-[420px] w-[420px] rounded-full bg-yellow-200/30 blur-2xl" />
      <div className="absolute left-10 top-28 h-10 w-28 rounded-full bg-white/70 shadow-sm" />
      <div className="absolute left-36 top-20 h-8 w-20 rounded-full bg-white/70 shadow-sm" />
      <div className="absolute right-24 top-24 h-10 w-28 rounded-full bg-white/70 shadow-sm" />
      <div className="absolute right-44 top-16 h-8 w-20 rounded-full bg-white/70 shadow-sm" />
    </div>
  );
}

function RightIllustration() {
  return (
    <div className="relative mx-auto max-w-sm">
      <div className="rounded-[48px] bg-white/60 p-10 shadow-sm backdrop-blur">
        <svg viewBox="0 0 260 220" className="h-auto w-full">
          <circle cx="70" cy="110" r="58" fill="#BAE6FD" />
          <circle cx="190" cy="105" r="62" fill="#A7F3D0" />
          <path
            d="M90 160c10 20 22 30 40 30s30-10 40-30"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <circle cx="130" cy="96" r="26" fill="#0F172A" />
          <circle cx="118" cy="90" r="5" fill="#fff" />
          <circle cx="142" cy="90" r="5" fill="#fff" />
          <path
            d="M128 105c2 4 4 6 6 6s4-2 6-6"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <div className="mt-5 text-center text-sm font-semibold text-gray-700">
          Welcome to your childcare portal
        </div>
      </div>
    </div>
  );
}

