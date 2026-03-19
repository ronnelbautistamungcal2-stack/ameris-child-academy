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
import { useEffect, useMemo, useRef, useState } from "react";

const STAFF_ROLES = new Set(["ADMIN", "TEACHER", "COACH"]);
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
    ["ADMIN", "TEACHER", "PARENT", "COACH", "SUBSCRIBER"],
    "/login",
  );

  const role = session?.user?.role || "";
  const isStaffRole = STAFF_ROLES.has(role);
  const navItems = useMemo(() => resolveNavItems(role), [role]);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [doh, setDoh] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [pictureUrl, setPictureUrl] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarRemoving, setAvatarRemoving] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const profileBusy = loadingProfile || saving || avatarUploading || avatarRemoving;
  const livePictureUrl = pictureUrl ?? session?.user?.pictureUrl ?? "";
  const displayName =
    name.trim() || session?.user?.name || session?.user?.email || "Account";

  const profileCompletion = useMemo(() => {
    const signals = [
      Boolean(name.trim()),
      Boolean(dob),
      Boolean(aboutMe.trim()),
      Boolean(livePictureUrl),
    ];
    if (isStaffRole) signals.push(Boolean(doh));
    const completeCount = signals.filter(Boolean).length;
    return Math.round((completeCount / signals.length) * 100);
  }, [aboutMe, dob, doh, isStaffRole, livePictureUrl, name]);

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

    setSaving(true);
    setError("");

    try {
      const payload = {
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
      setDob(savedUser?.dob ? String(savedUser.dob).slice(0, 10) : "");
      setDoh(savedUser?.hireDate ? String(savedUser.hireDate).slice(0, 10) : "");
      setAboutMe(savedUser?.aboutMe || "");
      setPictureUrl(savedUser?.pictureUrl ?? pictureUrl ?? "");

      await update?.({
        user: {
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

  return (
    <AppShell
      title="Account Settings"
      userName={session?.user?.name || session?.user?.email}
      userLabel={session?.user?.email}
      userImageUrl={livePictureUrl}
      navItems={navItems}
      showBack={false}
    >
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-white/70 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-6 shadow-[0_24px_80px_-48px_rgba(14,116,144,0.45)]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-sky-500" />
          <div className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-sky-100/70 blur-3xl" />
          <div className="absolute -bottom-16 left-0 h-36 w-36 rounded-full bg-amber-100/70 blur-3xl" />

          <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/90 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
                Account Settings
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-gray-900">
                Make your profile easy to recognize
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                Keep your profile details current, upload a real profile photo, and manage your password without digging through separate pages.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Completion"
                value={`${profileCompletion}%`}
                hint="Profile readiness"
                tone={profileCompletion >= 75 ? "emerald" : "amber"}
              />
              <StatCard
                label="Photo"
                value={livePictureUrl ? "Ready" : "Add"}
                hint={livePictureUrl ? "Uploaded" : "Missing"}
                tone={livePictureUrl ? "sky" : "gray"}
              />
              <StatCard
                label="Access"
                value={formatRoleLabel(role)}
                hint="Current role"
                tone="sky"
              />
              <StatCard
                label="Security"
                value={showPasswordForm ? "Editing" : "Ready"}
                hint="Password tools"
                tone={showPasswordForm ? "amber" : "gray"}
              />
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-6">
            <SettingsCard
              title="Profile photo"
              description="Your photo auto-saves as soon as you upload it."
              className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white"
              headerClassName="border-white/10 [&_h2]:text-white [&_p]:text-slate-300"
            >
              <AvatarUploader
                imageUrl={livePictureUrl}
                displayName={displayName}
                email={session?.user?.email}
                busy={profileBusy}
                uploading={avatarUploading}
                removing={avatarRemoving}
                onSelectFile={handleAvatarSelected}
                onRemove={handleAvatarRemove}
              />
            </SettingsCard>

            <SettingsCard
              title="Account snapshot"
              description="Quick reference details tied to this login."
            >
              <div className="space-y-4">
                <SnapshotRow label="Name" value={displayName} />
                <SnapshotRow label="Email" value={session?.user?.email || "-"} />
                <SnapshotRow label="Role" value={formatRoleLabel(role)} />
                <div className="rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500">
                    User ID
                  </div>
                  <div className="mt-2 break-all font-mono text-xs text-gray-700">
                    {session?.user?.id}
                  </div>
                </div>
              </div>
            </SettingsCard>
          </aside>

          <section className="space-y-6">
            <SettingsCard
              title="Profile details"
              description="Update the information coworkers and staff use most often."
              action={
                loadingProfile ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-sky-700">
                    Syncing profile
                  </span>
                ) : null
              }
            >
              <form onSubmit={saveProfile} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField label="Display name">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClassName}
                      placeholder="How your name should appear"
                      disabled={profileBusy}
                    />
                  </FormField>

                  <FormField label="Date of birth">
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className={inputClassName}
                      disabled={profileBusy}
                    />
                  </FormField>

                  {isStaffRole ? (
                    <FormField label="Date of hire">
                      <input
                        type="date"
                        value={doh}
                        onChange={(e) => setDoh(e.target.value)}
                        className={inputClassName}
                        disabled={profileBusy}
                      />
                    </FormField>
                  ) : null}

                  <div className="rounded-[24px] border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4">
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500">
                      Profile photo status
                    </div>
                    <div className="mt-2 text-lg font-black text-gray-900">
                      {livePictureUrl ? "Photo uploaded" : "No photo yet"}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      {livePictureUrl
                        ? "Your latest uploaded photo is already linked to the account."
                        : "Upload a real picture from the card on the left so staff can recognize you quickly."}
                    </div>
                  </div>
                </div>

                <FormField
                  label="About you"
                  hint={`${aboutMe.trim().length} characters`}
                >
                  <textarea
                    value={aboutMe}
                    onChange={(e) => setAboutMe(e.target.value)}
                    className={`${inputClassName} min-h-[140px] resize-y`}
                    placeholder="Share a short introduction, role context, or anything useful for the team."
                    disabled={profileBusy}
                  />
                </FormField>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    className="rounded-2xl bg-gradient-to-r from-blue-800 to-sky-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:from-blue-900 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={profileBusy}
                  >
                    {saving ? "Saving..." : "Save profile"}
                  </button>
                  <div className="text-sm text-gray-500">
                    {loadingProfile
                      ? "Loading current profile..."
                      : avatarUploading
                        ? "Uploading photo..."
                        : avatarRemoving
                          ? "Removing photo..."
                          : "Profile photo changes save immediately. Text changes save when you click the button."}
                  </div>
                </div>
              </form>
            </SettingsCard>

            <SettingsCard
              title="Password"
              description="Change your account password and keep access secure."
            >
              {!showPasswordForm ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                    Use at least 8 characters and avoid reusing old passwords.
                  </div>
                  <button
                    type="button"
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    onClick={() => setShowPasswordForm(true)}
                  >
                    Change password
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <FormField label="Current password">
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className={inputClassName}
                        disabled={changingPassword}
                      />
                    </FormField>

                    <FormField label="New password">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                        className={inputClassName}
                        disabled={changingPassword}
                      />
                    </FormField>

                    <FormField label="Confirm new password">
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        className={inputClassName}
                        disabled={changingPassword}
                      />
                    </FormField>
                  </div>

                  {passwordError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                      {passwordError}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="rounded-2xl bg-gradient-to-r from-blue-800 to-sky-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:from-blue-900 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {changingPassword ? "Changing..." : "Update password"}
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
                      className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </SettingsCard>

            <SettingsCard
              title="Danger zone"
              description="Delete access is intentionally restricted."
              className="border-red-200"
            >
              <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4">
                <div className="text-base font-extrabold text-red-800">
                  Account deletion is not self-service
                </div>
                <p className="mt-2 text-sm leading-6 text-red-700">
                  Contact an administrator if you need this account permanently removed. This prevents accidental data loss across messages, child records, and reporting history.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-2xl bg-red-500 px-4 py-2 text-sm font-extrabold text-white opacity-70"
                  disabled
                  title="Contact an administrator to delete your account"
                >
                  Delete account
                </button>
              </div>
            </SettingsCard>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function AvatarUploader({
  imageUrl,
  displayName,
  email,
  busy,
  uploading,
  removing,
  onSelectFile,
  onRemove,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const initialsText = initials(displayName || email || "User");

  function openPicker() {
    if (!busy) inputRef.current?.click();
  }

  async function handleFile(file) {
    if (!file) return;
    await onSelectFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={displayName}
            className="h-20 w-20 rounded-[24px] border border-white/10 object-cover shadow-lg"
          />
        ) : (
          <div className="grid h-20 w-20 place-items-center rounded-[24px] border border-white/10 bg-white/10 text-2xl font-black text-white shadow-lg">
            {initialsText}
          </div>
        )}

        <div className="min-w-0">
          <div className="truncate text-xl font-black text-white">{displayName}</div>
          <div className="mt-1 truncate text-sm text-slate-300">{email || "No email address"}</div>
          <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-200">
            {imageUrl ? "Uploaded photo" : "Initials fallback"}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={openPicker}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (busy) return;
          const file = e.dataTransfer?.files?.[0];
          if (file) handleFile(file);
        }}
        className={[
          "w-full rounded-[24px] border border-dashed px-4 py-5 text-left transition",
          dragOver
            ? "border-sky-300 bg-sky-400/10"
            : "border-white/15 bg-white/5 hover:bg-white/10",
          busy ? "cursor-not-allowed opacity-70" : "cursor-pointer",
        ].join(" ")}
        disabled={busy}
      >
        <div className="text-sm font-extrabold text-white">
          {uploading
            ? "Uploading profile photo..."
            : removing
              ? "Removing profile photo..."
              : "Click to upload or drag and drop"}
        </div>
        <div className="mt-1 text-sm text-slate-300">
          JPG, PNG, WEBP, or GIF up to 5MB.
        </div>
      </button>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openPicker}
          disabled={busy}
          className="rounded-2xl bg-white px-4 py-2 text-sm font-extrabold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {imageUrl ? "Replace photo" : "Choose photo"}
        </button>
        {imageUrl ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove photo
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
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

function SnapshotRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-3">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function StatCard({ label, value, hint, tone = "sky" }) {
  const tones = {
    sky: "border-sky-200 bg-sky-50/90 text-sky-900",
    emerald: "border-emerald-200 bg-emerald-50/90 text-emerald-900",
    amber: "border-amber-200 bg-amber-50/90 text-amber-900",
    gray: "border-gray-200 bg-white/90 text-gray-900",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.sky}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-gray-600">{hint}</div>
    </div>
  );
}

function resolveNavItems(role) {
  if (role === "ADMIN") return ADMIN_NAV_ITEMS;
  if (role === "TEACHER") return TEACHER_NAV_ITEMS;
  if (role === "COACH") return COACH_NAV_ITEMS;
  if (role === "PARENT") return PARENT_NAV_ITEMS;
  if (role === "SUBSCRIBER") return SUBSCRIBER_NAV_ITEMS;
  return [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/settings", label: "Account Settings" },
  ];
}

function formatRoleLabel(role) {
  return String(role || "User")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
