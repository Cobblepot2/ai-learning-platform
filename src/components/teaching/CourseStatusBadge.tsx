import type {
  TeachingCourseStatus,
  TeachingCourseVisibility,
} from "@/lib/teaching/overview";

const statusStyles: Record<TeachingCourseStatus, string> = {
  published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  draft: "bg-amber-50 text-amber-700 ring-amber-200",
  archived: "bg-stone-100 text-stone-600 ring-stone-200",
};

const statusLabels: Record<TeachingCourseStatus, string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

export function CourseStatusBadge({ status }: { status: TeachingCourseStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

const visibilityLabels: Record<TeachingCourseVisibility, string> = {
  private: "Private",
  enrolled: "Invited students",
  public: "Public",
};

export function VisibilityLabel({
  visibility,
}: {
  visibility: TeachingCourseVisibility;
}) {
  return (
    <span className="text-xs text-stone-500">
      {visibilityLabels[visibility]}
    </span>
  );
}
