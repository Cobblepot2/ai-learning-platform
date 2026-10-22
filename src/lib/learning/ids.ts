/** Same shape as the database guard on dynamic lesson-progress rows. */
export const DATABASE_COURSE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDatabaseCourseId(id: string): boolean {
  return DATABASE_COURSE_ID.test(id);
}
