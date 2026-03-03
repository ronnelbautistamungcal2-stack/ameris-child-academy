export default function OfflinePage() {
  return (
    <div className="grid min-h-screen place-items-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-sky-100 text-xl font-extrabold text-sky-700">
          ACA
        </div>
        <h1 className="mt-6 text-2xl font-extrabold text-gray-900 dark:text-white">
          You&apos;re offline
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Please check your internet connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full bg-sky-600 px-6 py-3 text-sm font-extrabold text-white hover:bg-sky-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
