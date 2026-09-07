import AdminLayout from "@/components/admin/AdminLayout";

/**
 * Placeholder shell for admin pages that exist in the navigation but whose
 * contents have not been defined yet.
 */
export default function AdminComingSoon({ icon = "🧭", title, description, planned = [] }) {
  return (
    <AdminLayout title={title}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-lg">
              {icon}
            </span>
            {title}
          </h2>
          {description && (
            <p className="mt-1.5 text-sm text-gray-500">{description}</p>
          )}
        </div>

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <div className="text-3xl">🚧</div>
          <h3 className="mt-3 text-base font-bold text-gray-900">
            This page is not built yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-500">
            The navigation entry is in place so the menu matches the agreed structure.
            We&apos;ll fill this in once we define what belongs here.
          </p>

          {planned.length > 0 && (
            <ul className="mx-auto mt-5 max-w-md space-y-2 text-left">
              {planned.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 rounded-xl bg-gray-50 px-4 py-2.5 text-sm text-gray-600"
                >
                  <span className="mt-0.5 text-gray-400">•</span>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
