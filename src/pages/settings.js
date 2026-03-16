import AppShell from "@/components/shell/AppShell";
import Skeleton from "@/components/ui/Skeleton";
import { useRequireRole } from "@/hooks/useRequireRole";
import { apiJson } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { ADMIN_NAV_ITEMS } from "@/components/admin/adminNav";
import { TEACHER_NAV_ITEMS } from "@/components/teacher/teacherNav";
import { PARENT_NAV_ITEMS } from "@/components/parent/parentNav";
import { COACH_NAV_ITEMS } from "@/components/coach/coachNav";
import { SUBSCRIBER_NAV_ITEMS } from "@/components/subscriber/subscriberNav";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const toast = useToast();
  const { session, status, allowed, update } = useRequireRole(
    ["ADMIN", "TEACHER", "PARENT", "COACH", "SUBSCRIBER"],
    "/login",
  );

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [doh, setDoh] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [pictureUrl, setPictureUrl] = useState("");
  const [pictureUrlError, setPictureUrlError] = useState("");

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;

    (async () => {
      setLoadingProfile(true);
      setError("");
      try {
        const u = await apiJson(`/api/v1/users/${session.user.id}`);
        setName(u?.name || "");
        setDob(u?.dob ? String(u.dob).slice(0, 10) : "");
        setDoh(u?.hireDate ? String(u.hireDate).slice(0, 10) : "");
        setAboutMe(u?.aboutMe || "");
        setPictureUrl(u?.pictureUrl || "");
        setPictureUrlError("");
      } catch (e) {
        setError(e.message || "Failed to load profile");
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [status, session?.user?.id]);

  useEffect(() => {
    const raw = (pictureUrl || "").trim();
    if (!raw) {
      setPictureUrlError("");
      return;
    }
    try {
      const parsed = new URL(raw);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setPictureUrlError("Picture URL must start with http:// or https://");
      } else {
        setPictureUrlError("");
      }
    } catch {
      setPictureUrlError("Picture URL is not a valid URL");
    }
  }, [pictureUrl]);

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
          currentPassword,
          newPassword,
        }),
      });
      toast.success("Password changed successfully.");
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setPasswordError(e.message || "Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (status !== "authenticated") return;
    if (pictureUrlError) {
      setError(pictureUrlError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      await apiJson(`/api/v1/users/${session.user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: name || null,
          dob: dob || null,
          hireDate: doh || null,
          aboutMe: aboutMe || null,
          pictureUrl: pictureUrl || null,
        }),
      });
      await update?.({
        user: {
          name: name || null,
          pictureUrl: pictureUrl || null,
        },
      });
      toast.success("Profile saved successfully.");
    } catch (e) {
      setError(e.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading")
    return <div className="p-6"><Skeleton count={5} /></div>;
  if (!allowed)
    return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;

  return (
    <AppShell
      title="Account Settings"
      userName={session?.user?.name || session?.user?.email}
      userLabel={session?.user?.email}
      userImageUrl={pictureUrl || session?.user?.pictureUrl}
      navItems={
        session?.user?.role === "ADMIN"
          ? ADMIN_NAV_ITEMS
          : session?.user?.role === "TEACHER"
            ? TEACHER_NAV_ITEMS
            : session?.user?.role === "COACH"
              ? COACH_NAV_ITEMS
              : session?.user?.role === "PARENT"
                ? PARENT_NAV_ITEMS
                : session?.user?.role === "SUBSCRIBER"
                  ? SUBSCRIBER_NAV_ITEMS
          : [
              { href: "/dashboard", label: "Dashboard" },
              { href: "/settings", label: "Account Settings" },
            ]
      }
      showBack={false}
    >
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">Account</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Your profile and basic account information.
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Field label="Name" value={session?.user?.name || "Not set"} />
            <Field label="Email" value={session?.user?.email || "—"} />
            <Field label="Role" value={session?.user?.role || "—"} />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                User ID
              </div>
              <div className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-200">
                {session?.user?.id}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
          <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100">Password</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Change your account password.
          </p>
          {!showPasswordForm ? (
            <button
              type="button"
              className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              onClick={() => setShowPasswordForm(true)}
            >
              Change Password
            </button>
          ) : (
            <form onSubmit={handlePasswordChange} className="mt-3 max-w-md space-y-3">
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Current Password
                </div>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  disabled={changingPassword}
                />
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  New Password
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  disabled={changingPassword}
                />
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Confirm New Password
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  disabled={changingPassword}
                />
              </label>
              {passwordError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                  {passwordError}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="rounded-xl bg-gradient-to-r from-blue-800 to-sky-600 px-4 py-2 text-sm font-extrabold text-white hover:from-blue-900 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {changingPassword ? "Changing..." : "Update Password"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordError("");
                  }}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
          <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100">Profile</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Name, DOB, DOH, about me, and picture.
          </p>

          <form onSubmit={saveProfile} className="mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Name
                </div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  disabled={loadingProfile || saving}
                />
              </label>

              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Picture URL
                </div>
                <input
                  value={pictureUrl}
                  onChange={(e) => setPictureUrl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="https://…"
                  disabled={loadingProfile || saving}
                />
                {pictureUrlError ? (
                  <div className="mt-2 text-xs font-semibold text-red-700">
                    {pictureUrlError}
                  </div>
                ) : null}
                {pictureUrl ? (
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800">
                    <img
                      src={pictureUrl}
                      alt="Profile preview"
                      className="h-12 w-12 rounded-full border border-gray-200 object-cover dark:border-gray-600"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextElementSibling.style.display = "";
                      }}
                    />
                    <div
                      className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-xs font-semibold text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
                      style={{ display: "none" }}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="min-w-0 text-xs text-gray-600 dark:text-gray-400">
                      Profile picture preview
                    </div>
                  </div>
                ) : null}
              </label>

              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  DOB
                </div>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  disabled={loadingProfile || saving}
                />
              </label>

              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  DOH
                </div>
                <input
                  type="date"
                  value={doh}
                  onChange={(e) => setDoh(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  disabled={loadingProfile || saving}
                />
              </label>
            </div>

            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                About me
              </div>
              <textarea
                value={aboutMe}
                onChange={(e) => setAboutMe(e.target.value)}
                className="mt-1 min-h-[110px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                disabled={loadingProfile || saving}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-blue-800 to-sky-600 px-4 py-2 text-sm font-extrabold text-white hover:from-blue-900 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loadingProfile || saving || !!pictureUrlError}
              >
                {saving ? "Saving…" : "Save Profile"}
              </button>
              {loadingProfile ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">Loading profile…</div>
              ) : null}
            </div>
          </form>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
          <h3 className="text-sm font-extrabold text-red-700 dark:text-red-400">Danger Zone</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button
            type="button"
            className="mt-3 rounded-2xl bg-red-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled
            title="Contact an administrator to delete your account"
          >
            Delete Account
          </button>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
            Contact an administrator to request account deletion.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}
