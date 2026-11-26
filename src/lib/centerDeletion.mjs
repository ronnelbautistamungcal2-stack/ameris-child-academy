// Deleting a center and everything in it, inside one transaction. Shared by
// DELETE /api/v1/centers/:id and scripts/delete-center.mjs (client sheet
// 10-29 (11), row 50: Ameris Demo and Ameris Test). If any table still points
// at the center, the transaction fails and nothing is deleted.

/** What a center holds, for a dry run. */
export async function centerContents(db, id) {
  const [children, classrooms, staff, attendance, activityLogs, lessons, threads] = await Promise.all([
    db.child.count({ where: { centerId: id } }),
    db.classRoom.count({ where: { centerId: id } }),
    db.centerUser.count({ where: { centerId: id } }),
    db.attendance.count({ where: { centerId: id } }),
    db.activityLog.count({ where: { child: { centerId: id } } }),
    db.lesson.count({ where: { centerId: id } }),
    db.messageThread.count({ where: { centerId: id } }),
  ]);
  return { children, classrooms, staff, attendance, activityLogs, lessons, threads };
}

/** Deletes the center's records, deepest first, then the center. Call inside prisma.$transaction. */
export async function deleteCenterData(tx, id) {
  const childIds = (await tx.child.findMany({ where: { centerId: id }, select: { id: true } })).map((c) => c.id);
  const classroomIds = (await tx.classRoom.findMany({ where: { centerId: id }, select: { id: true } })).map((c) => c.id);
  const checklistIds = (await tx.taskChecklist.findMany({ where: { centerId: id }, select: { id: true } })).map((c) => c.id);

  // Child-related records (deepest first)
  if (childIds.length) {
    await tx.progress.updateMany({ where: { childId: { in: childIds } }, data: { previousGoalId: null } });
    await tx.progressEntry.deleteMany({ where: { progress: { childId: { in: childIds } } } });
    await tx.progress.deleteMany({ where: { childId: { in: childIds } } });
    await tx.activityLog.deleteMany({ where: { childId: { in: childIds } } });
    await tx.formSubmission.deleteMany({ where: { childId: { in: childIds } } });
    await tx.childTask.deleteMany({ where: { childId: { in: childIds } } });
  }

  // Attendance
  await tx.attendance.deleteMany({ where: { centerId: id } });

  // Children (ChildGuardian, MilestoneChecklistItemCompletion cascade)
  await tx.child.deleteMany({ where: { centerId: id } });

  // Tasks and checklists
  if (checklistIds.length) {
    const taskIds = (await tx.task.findMany({ where: { checklistId: { in: checklistIds } }, select: { id: true } })).map((t) => t.id);
    if (taskIds.length) await tx.childTask.deleteMany({ where: { taskId: { in: taskIds } } });
    await tx.task.deleteMany({ where: { checklistId: { in: checklistIds } } });
  }
  await tx.taskChecklist.deleteMany({ where: { centerId: id } });

  // Classrooms
  if (classroomIds.length) await tx.teacherClass.deleteMany({ where: { classId: { in: classroomIds } } });
  await tx.classRoom.deleteMany({ where: { centerId: id } });

  // Lessons (LessonGoal, LessonRemediation cascade)
  await tx.lesson.deleteMany({ where: { centerId: id } });

  // Message threads (ThreadParticipant, Message cascade)
  await tx.messageThread.deleteMany({ where: { centerId: id } });

  // Form templates (FormSubmission cascades)
  await tx.formTemplate.deleteMany({ where: { centerId: id } });

  // Remaining direct relations
  await tx.policyDocument.deleteMany({ where: { centerId: id } });
  await tx.subscription.deleteMany({ where: { centerId: id } });
  await tx.centerUser.deleteMany({ where: { centerId: id } });
  await tx.progressArchive.deleteMany({ where: { centerId: id } });

  // The center (remaining relations with onDelete: Cascade clean up)
  await tx.center.delete({ where: { id } });
}
