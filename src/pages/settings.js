import AppShell from "@/components/shell/AppShell";
import { useRequireRole } from "@/hooks/useRequireRole";
import { apiJson } from "@/lib/api";
import { ADMIN_NAV_ITEMS } from "@/components/admin/adminNav";
import { TEACHER_NAV_ITEMS } from "@/components/teacher/teacherNav";
import { PARENT_NAV_ITEMS } from "@/components/parent/parentNav";
import { COACH_NAV_ITEMS } from "@/components/coach/coachNav";
import { SUBSCRIBER_NAV_ITEMS } from "@/components/subscriber/subscriberNav";
import { useEffect, useState } from "react";

export default function SettingsPage() {
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
    } catch (e) {
      setError(e.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading")
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
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
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-extrabold text-gray-900">Account</h2>
        <p className="mt-1 text-sm text-gray-600">
          Your profile and basic account information.
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Field label="Name" value={session?.user?.name || "Not set"} />
            <Field label="Email" value={session?.user?.email || "—"} />
            <Field label="Role" value={session?.user?.role || "—"} />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                User ID
              </div>
              <div className="mt-1 font-mono text-xs text-gray-900">
                {session?.user?.id}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <h3 className="text-sm font-extrabold text-gray-900">Password</h3>
          <p className="mt-1 text-sm text-gray-600">
            Manage your password from account settings.
          </p>
          <button
            type="button"
            className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            onClick={() => alert("Password reset is not implemented yet")}
          >
            Reset Password
          </button>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <h3 className="text-sm font-extrabold text-gray-900">Profile</h3>
          <p className="mt-1 text-sm text-gray-600">
            Name, DOB, DOH, about me, and picture.
          </p>

          <form onSubmit={saveProfile} className="mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Name
                </div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  disabled={loadingProfile || saving}
                />
              </label>

              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Picture URL
                </div>
                <input
                  value={pictureUrl}
                  onChange={(e) => setPictureUrl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="https://…"
                  disabled={loadingProfile || saving}
                />
                {pictureUrlError ? (
                  <div className="mt-2 text-xs font-semibold text-red-700">
                    {pictureUrlError}
                  </div>
                ) : null}
                {pictureUrl ? (
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <img
                      src={pictureUrl}
                      alt="Profile preview"
                      className="h-12 w-12 rounded-full border border-gray-200 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div className="min-w-0 text-xs text-gray-600">
                      Profile picture preview
                    </div>
                  </div>
                ) : null}
              </label>

              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  DOB
                </div>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  disabled={loadingProfile || saving}
                />
              </label>

              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  DOH
                </div>
                <input
                  type="date"
                  value={doh}
                  onChange={(e) => setDoh(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  disabled={loadingProfile || saving}
                />
              </label>
            </div>

            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                About me
              </div>
              <textarea
                value={aboutMe}
                onChange={(e) => setAboutMe(e.target.value)}
                className="mt-1 min-h-[110px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                disabled={loadingProfile || saving}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loadingProfile || saving || !!pictureUrlError}
              >
                {saving ? "Saving…" : "Save Profile"}
              </button>
              {loadingProfile ? (
                <div className="text-sm text-gray-600">Loading profile…</div>
              ) : null}
            </div>
          </form>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <h3 className="text-sm font-extrabold text-red-700">Danger Zone</h3>
          <p className="mt-1 text-sm text-gray-600">
            Account deletion is not implemented yet.
          </p>
          <button
            type="button"
            className="mt-3 rounded-2xl bg-red-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-red-600"
            onClick={() => alert("Delete account not implemented yet")}
          >
            Delete Account
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 font-semibold text-gray-900">{value}</div>
    </div>
  );
}
