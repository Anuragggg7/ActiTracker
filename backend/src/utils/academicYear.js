/**
 * Academic Year Utilities for ActivityTracker RCPIT
 * RCPIT Academic Year operates from June 1st to May 31st (Asia/Kolkata timezone)
 * Example: June 15, 2026 -> "2026–27"
 * Example: April 10, 2026 -> "2025–26"
 */

/**
 * Normalizes academic year string formats (e.g. "2026-27" or "2026–27" -> "2026–27")
 * @param {String} ay
 * @returns {String}
 */
export const normalizeAcademicYear = (ay) => {
  if (!ay || typeof ay !== 'string') return '';
  return ay.trim().replace(/[-–—]/g, '–');
};

/**
 * Determines institutional Academic Year from a given date
 * @param {Date|String} dateInput
 * @returns {String} Academic Year string (e.g. "2026–27")
 */
export const calculateAcademicYear = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
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

/**
 * Resolves Date range (UTC boundaries representing IST window) for an Academic Year
 * Example: "2026–27" -> { startDate: 2026-06-01T00:00:00.000Z, endDate: 2027-05-31T23:59:59.999Z, startYear: 2026, endYear: 2027 }
 * @param {String} ayInput
 * @returns {{ startDate: Date, endDate: Date, startYear: Number, endYear: Number, academicYear: String }}
 */
export const getAcademicYearDateRange = (ayInput) => {
  const normalized = normalizeAcademicYear(ayInput);
  const parts = normalized.split('–');
  let startYear = parseInt(parts[0], 10);

  if (isNaN(startYear)) {
    // Fallback to current academic year if invalid
    const currentAY = calculateAcademicYear(new Date());
    startYear = parseInt(currentAY.split('–')[0], 10);
  }

  const endYear = startYear + 1;
  const nextYearShort = endYear.toString().slice(-2);
  const academicYear = `${startYear}–${nextYearShort}`;

  // Start June 1st of startYear at 00:00:00 IST (UTC: May 31 18:30)
  const startDate = new Date(Date.UTC(startYear, 5, 1, 0, 0, 0, 0));
  // End May 31st of endYear at 23:59:59.999 IST
  const endDate = new Date(Date.UTC(endYear, 4, 31, 23, 59, 59, 999));

  return {
    startDate,
    endDate,
    startYear,
    endYear,
    academicYear
  };
};

/**
 * Checks if a given date falls within the selected academic year
 * @param {Date|String} dateInput
 * @param {String} ayInput
 * @returns {Boolean}
 */
export const isDateInAcademicYear = (dateInput, ayInput) => {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  const { startDate, endDate } = getAcademicYearDateRange(ayInput);
  return d >= startDate && d <= endDate;
};

/**
 * Returns available academic year choices for selection
 * @returns {Array<String>}
 */
export const getAvailableAcademicYears = () => {
  const currentAY = calculateAcademicYear(new Date());
  const currentStartYear = parseInt(currentAY.split('–')[0], 10);

  const years = [];
  // 3 past years, current year, 1 future year
  for (let y = currentStartYear - 3; y <= currentStartYear + 1; y++) {
    const nextShort = (y + 1).toString().slice(-2);
    years.push(`${y}–${nextShort}`);
  }

  return years;
};
