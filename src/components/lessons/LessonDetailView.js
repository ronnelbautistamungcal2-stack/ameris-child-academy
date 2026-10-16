import ProtectedLessonViewer from "@/components/lessons/ProtectedLessonViewer";
import ResourceLinks, { splitResourceList } from "@/components/lessons/ResourceLinks";
import { formatTermDaysLabel, normalizeTermDaySelections } from "@/lib/lessonScheduling";

function uniqueList(values) {
  return [...new Set(values.filter(Boolean))];
}

function DetailLine({ label, value }) {
  if (!value) return null;
  return (
    <div className="text-sm leading-6 text-gray-800">
      <span className="font-semibold text-gray-600">{label}:</span> {value}
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
      {children}
    </div>
  );
}

// What a teacher sees after clicking a lesson in the weekly plan: the lesson
// details up top, then the protected Lesson file rendered inline so it opens
// without any extra click.
export default function LessonDetailView({ lesson, onClose, hideHeader = false }) {
  const goals = (Array.isArray(lesson?.goals) ? lesson.goals : [])
    .slice()
    .sort((a, b) => Number(a.goalIndex || 0) - Number(b.goalIndex || 0));
  const criteria = goals.map((g) => g?.passingCriteria || {});
  const first = criteria[0] || {};

  const title = first.lesson || lesson?.title || "Lesson";
  const termDays = normalizeTermDaySelections(lesson?.termDays).length
    ? formatTermDaysLabel(lesson.termDays)
    : "";
  const links = uniqueList(criteria.map((pc) => String(pc.link || "").trim()));
  const resources = uniqueList(criteria.flatMap((pc) => splitResourceList(pc.lessonAttachment)));
  const lessonFiles = uniqueList(criteria.flatMap((pc) => splitResourceList(pc.lessonDocument)));
  const notes = uniqueList(criteria.map((pc) => String(pc.notes || "").trim()));
  const media = Array.isArray(lesson?.media) ? lesson.media.filter(Boolean) : [];
  const supplies = Array.isArray(lesson?.supplies) ? lesson.supplies : [];

  return (
    <div>
      {hideHeader ? null : (
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-extrabold leading-snug text-gray-900">
            Lesson Title: {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      )}

      <div className={`space-y-0.5 ${hideHeader ? "" : "mt-3"}`}>
        <DetailLine label="Ref #" value={first.reference || lesson?.reference} />
        <DetailLine label="Category" value={first.category || lesson?.category?.name} />
        <DetailLine label="Subcategory" value={first.subject || lesson?.subCategory} />
        <DetailLine label="Age" value={first.age || lesson?.category?.ageRange} />
        <DetailLine label="Term" value={first.term || lesson?.term} />
        <DetailLine label="Days" value={termDays} />
        <DetailLine label="Slot" value={lesson?.lessonSlot} />
        <DetailLine label="Linked lesson" value={lesson?.linkedLesson?.title} />
      </div>

      {lesson?.description ? (
        <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-800">
          {lesson.description}
        </div>
      ) : null}

      {supplies.length ? (
        <div className="mt-5">
          <SectionHeading>Supplies</SectionHeading>
          <ul className="space-y-1">
            {supplies.map((s) => (
              <li key={s.id} className="text-sm leading-6 text-gray-700">
                <span className="font-semibold text-gray-900">{s.name}</span>
                {" — "}
                {s.quantity || 1}
                {s.quantityType === "per_student" ? " per student" : ""}
                {s.unit ? ` ${s.unit}` : ""}
                {s.notes ? <span className="text-gray-500"> ({s.notes})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {links.length ? (
        <div className="mt-4 text-sm leading-6 text-gray-800">
          <span className="font-semibold text-gray-600">Link:</span>{" "}
          {links.map((link, i) => (
            <span key={link}>
              {i > 0 ? ", " : null}
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="break-all text-blue-600 hover:text-blue-700"
              >
                {link}
              </a>
            </span>
          ))}
        </div>
      ) : null}

      {resources.length || media.length ? (
        <div className="mt-4">
          <SectionHeading>Additional Resources</SectionHeading>
          <ResourceLinks
            value={[...resources, ...media].join("\n")}
            className="list-disc space-y-1 pl-5 text-sm"
          />
        </div>
      ) : null}

      {lesson?.policyDocument ? (
        <a
          href={lesson.policyDocument.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 no-underline hover:bg-indigo-200"
        >
          Policy: {lesson.policyDocument.title}
        </a>
      ) : null}

      {notes.length ? (
        <div className="mt-4">
          <SectionHeading>Notes</SectionHeading>
          {notes.map((n) => (
            <div key={n} className="whitespace-pre-wrap text-sm leading-6 text-gray-800">
              {n}
            </div>
          ))}
        </div>
      ) : null}

      {lessonFiles.length ? (
        <div className="mt-5">
          <SectionHeading>Lesson</SectionHeading>
          <ProtectedLessonViewer urls={lessonFiles} />
        </div>
      ) : null}
    </div>
  );
}
