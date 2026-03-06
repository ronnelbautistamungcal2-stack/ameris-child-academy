export default function FormField({
  label,
  required,
  error,
  hint,
  children,
  className = "",
}) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 animate-[toastIn_0.2s_ease-out]">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
            <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm-.75-4.85V5.65h1.5v4.5h-1.5zm0 2.2v-1.5h1.5v1.5h-1.5z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      )}
    </div>
  );
}
