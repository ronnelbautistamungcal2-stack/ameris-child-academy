import Skeleton from "@/components/ui/Skeleton";
import { useShellTitle } from "@/components/shell/PortalShell";
import { useRequireRole } from "@/hooks/useRequireRole";
import { apiJson } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import NotificationPreferences from "@/components/parent/NotificationPreferences";
import { useEffect, useState } from "react";
import { STAFF_PORTAL_ROLES } from "@/lib/roles";

const STAFF_ROLES = new Set(["ADMIN", "TEACHER", ...STAFF_PORTAL_ROLES, "COACH"]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export default function SettingsPage() {
  const toast = useToast();
  const { session, status, allowed, update } = useRequireRole(
    ["ADMIN", "TEACHER", ...STAFF_PORTAL_ROLES, "PARENT", "COACH"],
    "/login",
  );

  useShellTitle("Account Settings");

  const role = session?.user?.role || "";
  const mustChangePassword = Boolean(session?.user?.mustChangePassword);
  const isStaffRole = STAFF_ROLES.has(role);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [doh, setDoh] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [pictureUrl, setPictureUrl] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarRemoving, setAvatarRemoving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const profileBusy = loadingProfile || saving || avatarUploading || avatarRemoving;
  const livePictureUrl = pictureUrl ?? session?.user?.pictureUrl ?? "";
  const displayName =
    name.trim() || session?.user?.name || session?.user?.email || "Account";


  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    (async () => {
      setLoadingProfile(true);
      setError("");
      try {
        const user = await apiJson(`/api/v1/users/${session.user.id}`);
        if (cancelled) return;
        setName(user?.name || "");
        setEmail(user?.email || session.user.email || "");
        setDob(user?.dob ? String(user.dob).slice(0, 10) : "");
        setDoh(user?.hireDate ? String(user.hireDate).slice(0, 10) : "");
        setAboutMe(user?.aboutMe || "");
        setPictureUrl(user?.pictureUrl ?? "");
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Failed to load profile");
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id]);

  async function handleAvatarSelected(file) {
    if (status !== "authenticated") return;
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      const message = "Use a JPG, PNG, WEBP, or GIF image for the profile photo.";
      setError(message);
      toast.error(message);
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      const message = "Profile photos must be 5MB or smaller.";
      setError(message);
      toast.error(message);
      return;
    }

    setAvatarUploading(true);
    setError("");

    try {
      const dataBase64 = await fileToBase64(file);
      const result = await apiJson(`/api/v1/users/${session.user.id}/avatar`, {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          dataBase64,
        }),
      });
      const nextPictureUrl = result?.pictureUrl || "";
      setPictureUrl(nextPictureUrl);
      await update?.({
        user: {
          name: name.trim() || session?.user?.name || null,
          pictureUrl: nextPictureUrl || null,
        },
      });
      toast.success("Profile photo updated.");
    } catch (e) {
      const message = e.message || "Failed to upload profile photo";
      setError(message);
      toast.error(message);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleAvatarRemove() {
    if (status !== "authenticated" || !livePictureUrl) return;

    setAvatarRemoving(true);
    setError("");

    try {
      await apiJson(`/api/v1/users/${session.user.id}/avatar`, {
        method: "DELETE",
      });
      setPictureUrl("");
      await update?.({
        user: {
          name: name.trim() || session?.user?.name || null,
          pictureUrl: null,
        },
      });
      toast.success("Profile photo removed.");
    } catch (e) {
      const message = e.message || "Failed to remove profile photo";
      setError(message);
      toast.error(message);
    } finally {
      setAvatarRemoving(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (status !== "authenticated") return;
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      await apiJson(`/api/v1/users/${session.user.id}/password`, {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: mustChangePassword ? undefined : currentPassword,
          newPassword,
        }),
      });
      toast.success("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await update?.({
        user: {
          mustChangePassword: false,
        },
      });
    } catch (e) {
      setPasswordError(e.message || "Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (status !== "authenticated") return;

    setSaving(true);
    setError("");

    try {
      const payload = {
        email: email.trim() || null,
        name: name.trim() || null,
        dob: dob || null,
        aboutMe: aboutMe.trim() || null,
      };

      if (isStaffRole) {
        payload.hireDate = doh || null;
      }

      const savedUser = await apiJson(`/api/v1/users/${session.user.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setName(savedUser?.name || "");
      setEmail(savedUser?.email || "");
      setDob(savedUser?.dob ? String(savedUser.dob).slice(0, 10) : "");
      setDoh(savedUser?.hireDate ? String(savedUser.hireDate).slice(0, 10) : "");
      setAboutMe(savedUser?.aboutMe || "");
      setPictureUrl(savedUser?.pictureUrl ?? pictureUrl ?? "");

      await update?.({
        user: {
          email: savedUser?.email || null,
          name: savedUser?.name || null,
          pictureUrl: savedUser?.pictureUrl || livePictureUrl || null,
        },
      });

      toast.success("Profile saved successfully.");
    } catch (e) {
      const message = e.message || "Failed to save profile";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="p-6">
        <Skeleton count={5} />
      </div>
    );
  }

  if (!allowed) {
    return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;
  }

  const isParentRole = role === "PARENT";
  const photoCard = (
    <SettingsCard title="Profile Photo">
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        {livePictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={livePictureUrl} alt={displayName} className="h-36 w-36 rounded-full object-cover" />
        ) : (
          <div className="flex h-36 w-36 items-center justify-center rounded-full bg-gray-200 text-4xl font-black text-gray-500 dark:bg-gray-700" aria-hidden="true">
            {initials(displayName)}
          </div>
        )}
        <label className={`cursor-pointer rounded-lg border border-blue-600 px-5 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 dark:text-blue-300 ${profileBusy ? "pointer-events-none opacity-60" : ""}`}>
          {avatarUploading ? "Uploading..." : "Change Photo"}
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="sr-only" disabled={profileBusy} onChange={(e) => { handleAvatarSelected(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {livePictureUrl ? (
          <button type="button" onClick={handleAvatarRemove} disabled={profileBusy} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-60">
            {avatarRemoving ? "Removing..." : "Remove photo"}
          </button>
        ) : null}
        <p className="text-xs text-gray-500">JPG, PNG or GIF. Max size 5 MB.</p>
      </div>
    </SettingsCard>
  );

  const detailsCard = (
    <SettingsCard title="Profile Details">
      <form onSubmit={saveProfile} className="space-y-3">
        <FormField label="Full Name *">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} disabled={profileBusy} required />
        </FormField>
        <FormField label="Email Address *">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClassName} disabled={profileBusy} required />
        </FormField>
        <div className={`grid gap-3 ${isStaffRole ? "sm:grid-cols-2" : ""}`}>
          <FormField label="Date of Birth">
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputClassName} disabled={profileBusy} />
          </FormField>
          {isStaffRole ? (
            <FormField label="Date of Hire">
              <input type="date" value={doh} onChange={(e) => setDoh(e.target.value)} className={inputClassName} disabled={profileBusy} />
            </FormField>
          ) : null}
        </div>
        <FormField label="About You" hint={`${aboutMe.length}/500`}>
          <textarea value={aboutMe} onChange={(e) => setAboutMe(e.target.value.slice(0, 500))} maxLength={500} className={`${inputClassName} min-h-[90px] resize-y`} disabled={profileBusy} />
        </FormField>
        <div className="flex justify-end">
          <button type="submit" disabled={profileBusy} className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </SettingsCard>
  );

  const passwordCard = (
    <SettingsCard title="Change Password">
      {mustChangePassword ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your account is using a temporary password. Set a new password now to unlock the rest of the system.
        </div>
      ) : null}
      <form onSubmit={handlePasswordChange} className="space-y-3">
        {!mustChangePassword ? (
          <FormField label="Current Password *">
            <PasswordInput value={currentPassword} onChange={setCurrentPassword} disabled={changingPassword} />
          </FormField>
        ) : null}
        <FormField label="New Password *">
          <PasswordInput value={newPassword} onChange={setNewPassword} disabled={changingPassword} minLength={8} />
        </FormField>
        <FormField label="Confirm New Password *">
          <PasswordInput value={confirmPassword} onChange={setConfirmPassword} disabled={changingPassword} minLength={8} />
        </FormField>
        {passwordError ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{passwordError}</div> : null}
        <div className="flex justify-end">
          <button type="submit" disabled={changingPassword} className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {changingPassword ? "Updating..." : "Update Password"}
          </button>
        </div>
      </form>
    </SettingsCard>
  );

  const preferencesCard = <AccountPreferences userId={session?.user?.id} wide={isParentRole} />;

  return (
    <>
      {/* Account Settings (client mockups 2026-10-29: r077 all roles, r079 parents). */}
      <div className="space-y-5">
        <h1 className="text-3xl font-black text-[#0b2a5b] dark:text-blue-100">Account Settings</h1>
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          {photoCard}
          {detailsCard}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {passwordCard}
          {isParentRole ? (
            <SettingsCard title="Notification Settings">
              <NotificationPreferences />
            </SettingsCard>
          ) : (
            preferencesCard
          )}
        </div>
        {isParentRole ? preferencesCard : null}
        {/* Parents sign children in and out at the kiosk with a PIN too, so they
            can view it here after entering their password (client sheet 2026-11-07). */}
        {session?.user?.id ? <KioskPinCard userId={session.user.id} /> : null}
      </div>
    </>
  );
}

function PasswordInput({ value, onChange, disabled, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
        disabled={disabled}
        className={`${inputClassName} pr-10`}
      />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-gray-500">
        {show ? "🙈" : "👁"}
      </button>
    </div>
  );
}

const LANGUAGES = ["English", "Spanish"];
const DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];
const TIME_ZONES = [
  ["America/New_York", "(GMT-05:00) Eastern Time (US & Canada)"],
  ["America/Chicago", "(GMT-06:00) Central Time (US & Canada)"],
  ["America/Denver", "(GMT-07:00) Mountain Time (US & Canada)"],
  ["America/Phoenix", "(GMT-07:00) Arizona"],
  ["America/Los_Angeles", "(GMT-08:00) Pacific Time (US & Canada)"],
  ["America/Anchorage", "(GMT-09:00) Alaska"],
  ["Pacific/Honolulu", "(GMT-10:00) Hawaii"],
];

/** Language, date format and time zone, kept in this browser for now. */
function AccountPreferences({ userId, wide }) {
  const key = `aca:accountPreferences:${userId || "me"}`;
  const [prefs, setPrefs] = useState({ language: "English", dateFormat: "MM/DD/YYYY", timeZone: "America/Denver" });
  const [savedNote, setSavedNote] = useState(false);
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(key) || "null");
      if (stored) setPrefs((p) => ({ ...p, ...stored }));
    } catch {
      // keep the defaults
    }
  }, [key]);
  function change(patch) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
      setSavedNote(true);
    } catch {
      setSavedNote(false);
    }
  }
  return (
    <SettingsCard title="Account Preferences">
      <div className={`grid gap-3 ${wide ? "sm:grid-cols-2" : ""}`}>
        <FormField label="Preferred Language">
          <select value={prefs.language} onChange={(e) => change({ language: e.target.value })} className={inputClassName}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </FormField>
        <FormField label="Date Format">
          <select value={prefs.dateFormat} onChange={(e) => change({ dateFormat: e.target.value })} className={inputClassName}>
            {DATE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </FormField>
        <FormField label="Time Zone">
          <select value={prefs.timeZone} onChange={(e) => change({ timeZone: e.target.value })} className={inputClassName}>
            {TIME_ZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormField>
      </div>
      {savedNote ? <p className="mt-2 text-xs text-gray-500">Saved.</p> : null}
    </SettingsCard>
  );
}


// "View PIN" (client request 2026-10-02): after re-entering their password a
// user sees the 6-digit PIN they set at the front-desk kiosk. It cannot be
// changed here; an administrator issues a registration number for a new one.
const PIN_VISIBLE_MS = 30 * 1000;

function KioskPinCard({ userId }) {
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!result?.pin) return undefined;
    const timer = setTimeout(() => setResult(null), PIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [result]);

  function reset() {
    setAsking(false);
    setPassword("");
    setError("");
    setResult(null);
  }

  async function viewPin(e) {
    e.preventDefault();
    setChecking(true);
    setError("");
    try {
      const data = await apiJson(`/api/v1/users/${encodeURIComponent(userId)}/pin`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setResult(data);
      setAsking(false);
      setPassword("");
    } catch (err) {
      setError(err.message || "Could not check your password");
    } finally {
      setChecking(false);
    }
  }

  return (
    <SettingsCard
      title="Kiosk PIN"
      description="The 6-digit PIN you use to sign in and out at the front desk kiosk."
    >
      {result ? (
        result.hasPin ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 font-mono text-3xl font-black tracking-[0.35em] text-sky-900 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-100">
              {result.pin}
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Hide PIN
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
            You have not set a kiosk PIN yet. Ask your administrator for a registration number, then tap
            Register at the kiosk to choose your PIN.
          </div>
        )
      ) : asking ? (
        <form onSubmit={viewPin} className="space-y-4">
          <div className="max-w-sm">
            <FormField label="Enter your password to view your PIN">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className={inputClassName}
                disabled={checking}
              />
            </FormField>
          </div>
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={checking}
              className="rounded-2xl bg-gradient-to-r from-blue-800 to-sky-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:from-blue-900 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checking ? "Checking..." : "View PIN"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Your PIN is hidden. To change it, ask your administrator for a new registration number.
          </div>
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            View PIN
          </button>
        </div>
      )}
    </SettingsCard>
  );
}

function SettingsCard({
  title,
  description,
  action,
  children,
  className = "",
  headerClassName = "",
}) {
  return (
    <section className={`rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 ${className}`.trim()}>
      {(title || description || action) ? (
        <div className={`flex flex-col gap-3 border-b border-gray-100 pb-4 dark:border-gray-700 sm:flex-row sm:items-start sm:justify-between ${headerClassName}`.trim()}>
          <div>
            {title ? (
              <h2 className="text-lg font-black tracking-tight text-gray-900 dark:text-gray-100">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={title || description || action ? "pt-5" : ""}>{children}</div>
    </section>
  );
}

function FormField({ label, hint, children }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
        {label}
      </div>
      {children}
      {hint ? <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</div> : null}
    </label>
  );
}



function initials(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return "U";
  return parts.map((part) => part[0].toUpperCase()).join("");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

const inputClassName =
  "w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500";
