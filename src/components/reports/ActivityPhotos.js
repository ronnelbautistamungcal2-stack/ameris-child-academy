// Photos attached to a Daily Log entry (details.media, or details.photos on
// older entries). Shown wherever a log is viewed, not only when it is edited
// (client request 2026-10-29).

export function activityPhotoUrls(activity) {
  const details = activity?.details && typeof activity.details === "object" ? activity.details : {};
  const raw = [
    ...(Array.isArray(details.media) ? details.media : []),
    ...(Array.isArray(details.photos) ? details.photos : []),
  ];
  return [
    ...new Set(
      raw
        .map((item) => (typeof item === "string" ? item : typeof item?.url === "string" ? item.url : ""))
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  ];
}

export default function ActivityPhotos({ activity, urls, size = "h-20 w-20", className = "" }) {
  const list = urls || activityPhotoUrls(activity);
  if (!list.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {list.map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700" title="Open photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Daily Log photo" loading="lazy" className={`${size} object-cover`} />
        </a>
      ))}
    </div>
  );
}
