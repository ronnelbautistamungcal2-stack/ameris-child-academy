import Link from "next/link";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import AmerisLogo from "@/components/ui/AmerisLogo";

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
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_480px] lg:gap-16">
          {/* Logo */}
          <Link
            href="/"
            className="mx-auto block w-[min(260px,70vw)] lg:mx-0 lg:mt-4 lg:w-[460px] lg:self-start"
            aria-label="Ameris Academy home"
          >
            <AmerisLogo
              size="xl"
              showTagline
              className="drop-shadow-[0_2px_12px_rgba(255,255,255,0.85)]"
              style={{ width: "100%" }}
            />
          </Link>

          <div className="w-full max-w-[480px] justify-self-center rounded-3xl border border-white/70 bg-white/95 p-8 shadow-2xl shadow-slate-900/20 backdrop-blur animate-[modalIn_0.4s_ease-out] lg:justify-self-end dark:border-gray-700 dark:bg-gray-900/90">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-800 hover:text-blue-900"
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
                className="mt-2 w-full rounded-full bg-gradient-to-r from-blue-800 to-sky-600 px-4 py-3 text-sm font-extrabold text-white hover:from-blue-900 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing up..." : "Sign Up"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              I already have an account.{" "}
              <Link href="/login" className="font-semibold text-blue-800 hover:text-blue-900">
                Log in
              </Link>
            </div>
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
