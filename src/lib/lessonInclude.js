// The relations the lessons API returns with a full lesson (Lesson Bank and
// Steps of Progression rows, the edit pop-ups).
export const LESSON_INCLUDE = {
  category: true,
  goals: { orderBy: { goalIndex: "asc" } },
  remediationsFrom: { include: { toLesson: true } },
  supplies: { orderBy: { name: "asc" } },
  policyDocument: true,
  linkedLesson: {
    select: {
      id: true,
      title: true,
      term: true,
      reference: true,
    },
  },
  priorStep: { select: { id: true, title: true, reference: true } },
  nextStep: { select: { id: true, title: true, reference: true } },
};
