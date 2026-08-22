/**
 * Determines institutional Academic Year from a given date
 * RCPIT Academic Year runs from June 1st to May 31st
 * Example: June 15, 2026 -> "2026–27"
 * Example: April 10, 2026 -> "2025–26"
 * @param {Date|String} dateInput
 * @returns {String} Academic Year string (e.g. "2026–27")
 */
export const calculateAcademicYear = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1 to 12

  // June (6) to December (12) belongs to year-(year+1)
  // January (1) to May (5) belongs to (year-1)-year
  if (month >= 6) {
    const nextYearShort = (year + 1).toString().slice(-2);
    return `${year}–${nextYearShort}`;
  } else {
    const prevYear = year - 1;
    const currentYearShort = year.toString().slice(-2);
    return `${prevYear}–${currentYearShort}`;
  }
};
