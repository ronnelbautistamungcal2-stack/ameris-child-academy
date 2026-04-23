export function startOfDay(value = new Date()) {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function isAttendanceCheckedIn(attendance) {
  return !!attendance?.checkedInAt && !attendance?.checkedOutAt;
}

export function getEffectiveClassRoomId(child, attendance = null) {
  const defaultClassRoomId =
    child?.defaultClassRoomId !== undefined
      ? child.defaultClassRoomId
      : child?.classRoomId || null;
  const attendanceClassRoomId =
    attendance?.classRoomId !== undefined
      ? attendance.classRoomId
      : child?.todayAttendance?.classRoomId;

  return attendanceClassRoomId !== undefined && attendanceClassRoomId !== null
    ? attendanceClassRoomId
    : defaultClassRoomId;
}

export function decorateChildWithTodayAttendance(
  child,
  attendance = null,
  options = {},
) {
  const replaceClassRoomId = options.replaceClassRoomId === true;
  const defaultClassRoomId =
    child?.defaultClassRoomId !== undefined
      ? child.defaultClassRoomId
      : child?.classRoomId || null;
  const todayAttendance = attendance || child?.todayAttendance || null;
  const effectiveClassRoomId = getEffectiveClassRoomId(
    { ...child, defaultClassRoomId },
    todayAttendance,
  );
  const hasTemporaryClassRoomToday =
    effectiveClassRoomId !== null && effectiveClassRoomId !== defaultClassRoomId;

  return {
    ...child,
    defaultClassRoomId,
    classRoomId: replaceClassRoomId ? effectiveClassRoomId : child?.classRoomId || null,
    effectiveClassRoomId,
    hasTemporaryClassRoomToday,
    todayAttendance,
  };
}

export function attendanceByChildId(records) {
  const map = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    if (record?.childId) map.set(record.childId, record);
  }
  return map;
}
