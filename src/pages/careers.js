import { useState } from "react";
import { useRouter } from "next/router";
import PublicLayout from "@/components/public/PublicLayout";
import { UploadIcon } from "@/components/public/icons";

export default function CareersPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mailingAddress: "",
    position: "",
    startDate: "",
    employmentType: "full-time",
    education: "",
    experience: "",
  });

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitted(true);
      setSubmitting(false);
    }, 1000);
  }

  return (
    <PublicLayout title="Careers" description="Apply to join the Ameris team">
      <section className="bg-gradient-to-b from-sky-50 to-white py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <span className="inline-block rounded-full bg-sky-100 px-4 py-1.5 text-xs font-semibold text-sky-700">
              Join Our Team
            </span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900 lg:text-4xl">
              Career Application Form
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600">
              Help us shape the future of early childhood education. We&apos;re looking for passionate individuals.
            </p>
          </div>

          {submitted ? (
            <div className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
              <p className="text-lg font-semibold text-emerald-800">Application Submitted!</p>
              <p className="mt-2 text-sm text-emerald-700">
                Thank you for your interest. We&apos;ll review your application and contact you within 5-7 business days.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10 space-y-10">
              {/* Personal Information */}
              <fieldset className="rounded-2xl border border-gray-200 bg-white p-6 lg:p-8">
                <legend className="text-lg font-extrabold text-gray-900">Personal Information</legend>
                <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field label="First Name" name="firstName" value={form.firstName} onChange={handleChange} placeholder="Enter first name" required />
                  <Field label="Last Name" name="lastName" value={form.lastName} onChange={handleChange} placeholder="Enter last name" required />
                  <Field label="Email Address" name="email" type="email" value={form.email} onChange={handleChange} placeholder="e.g@example.com" required />
                  <Field label="Phone Number" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="(555) 000-0000" required />
                </div>
                <div className="mt-5">
                  <Field label="Mailing Address" name="mailingAddress" value={form.mailingAddress} onChange={handleChange} placeholder="123 Example Way, Suite 100" />
                </div>
              </fieldset>

              {/* Position of Interest */}
              <fieldset className="rounded-2xl border border-gray-200 bg-white p-6 lg:p-8">
                <legend className="text-lg font-extrabold text-gray-900">Position of Interest</legend>
                <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Select Position</span>
                    <select
                      name="position"
                      value={form.position}
                      onChange={handleChange}
                      required
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                    >
                      <option value="">Search a role...</option>
                      <option value="teacher">Teacher</option>
                      <option value="assistant-teacher">Assistant Teacher</option>
                      <option value="admin">Administrative Staff</option>
                      <option value="coach">Education Coach</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <Field label="Earliest Start Date" name="startDate" type="date" value={form.startDate} onChange={handleChange} placeholder="mm/dd/yyyy" />
                </div>
                <div className="mt-5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Employment Type</span>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {["full-time", "part-time", "temporary"].map((type) => (
                      <label key={type} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="employmentType"
                          value={type}
                          checked={form.employmentType === type}
                          onChange={handleChange}
                          className="h-4 w-4 border-gray-300 text-sky-600 focus:ring-sky-500"
                        />
                        {type.charAt(0).toUpperCase() + type.slice(1).replace("-", " ")}
                      </label>
                    ))}
                  </div>
                </div>
              </fieldset>

              {/* Education & Experience */}
              <fieldset className="rounded-2xl border border-gray-200 bg-white p-6 lg:p-8">
                <legend className="text-lg font-extrabold text-gray-900">Education & Experience</legend>
                <div className="mt-4">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Highest Level of Education</span>
                    <select
                      name="education"
                      value={form.education}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                    >
                      <option value="">High School Diploma / GED</option>
                      <option value="associate">Associate Degree</option>
                      <option value="bachelor">Bachelor&apos;s Degree</option>
                      <option value="master">Master&apos;s Degree</option>
                      <option value="doctorate">Doctorate</option>
                    </select>
                  </label>
                </div>
                <div className="mt-5">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Relevant Experience</span>
                    <textarea
                      name="experience"
                      value={form.experience}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Briefly describe your experience in childcare or education..."
                      className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                    />
                  </label>
                </div>
              </fieldset>

              {/* Resume & Documents */}
              <fieldset className="rounded-2xl border border-gray-200 bg-white p-6 lg:p-8">
                <legend className="text-lg font-extrabold text-gray-900">Resume & Documents</legend>
                <div
                  className={[
                    "mt-4 rounded-2xl border-2 border-dashed p-8 text-center transition",
                    dragOver ? "border-sky-400 bg-sky-50" : "border-gray-200 bg-gray-50",
                  ].join(" ")}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
                  }}
                >
                  <UploadIcon className="mx-auto h-10 w-10 text-gray-400" />
                  <p className="mt-3 text-sm text-gray-600">
                    Click to upload or drag and drop
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    PDF, DOC, or DOCX (max 5MB)
                  </p>
                  <label className="mt-4 inline-flex cursor-pointer rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    Browse Files
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        if (e.target.files[0]) setFile(e.target.files[0]);
                      }}
                    />
                  </label>
                  {file && (
                    <p className="mt-3 text-sm font-semibold text-gray-900">{file.name}</p>
                  )}
                </div>
              </fieldset>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-sky-600 px-6 py-3 text-sm font-extrabold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Application"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

/* ── Reusable Field ───────────────────────────────────── */

function Field({ label, name, type = "text", value, onChange, placeholder, required }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
      />
    </label>
  );
}
