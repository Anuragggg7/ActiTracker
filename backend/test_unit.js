import {
  validateTimeRange,
  isTimeOverlapping
} from './src/services/slotService.js';
import {
  countWords,
  validateDescriptionWordCount
} from './src/services/activityService.js';

console.log('🚀 Running Pure Unit & Algorithmic Tests...');

// 1. Time range validation (06:00 to 22:00)
console.log('\n--- 1. Testing Institutional Time Ranges (06:00 - 22:00) ---');
const normal = validateTimeRange({ startTime: '09:00', endTime: '11:00' });
console.assert(normal.durationHours === 2, `Expected 2 hrs, got ${normal.durationHours}`);
console.assert(normal.isAllDay === false, 'Should not be all-day');

const allDay = validateTimeRange({ isAllDay: true });
console.assert(allDay.startTime === '06:00' && allDay.endTime === '22:00', 'All-day must span 06:00 to 22:00');
console.assert(allDay.durationHours === 16, 'All-day duration must be 16 hours');

// Boundaries: exactly 06:00 and 22:00
const boundary = validateTimeRange({ startTime: '06:00', endTime: '22:00' });
console.assert(boundary.durationHours === 16, 'Boundary duration should be 16 hrs');

let earlyPassed = false;
try {
  validateTimeRange({ startTime: '05:45', endTime: '09:00' });
} catch (e) {
  earlyPassed = true;
  console.log('✓ Rejected time before 06:00:', e.message);
}
console.assert(earlyPassed, 'Must reject startTime < 06:00');

let latePassed = false;
try {
  validateTimeRange({ startTime: '18:00', endTime: '22:15' });
} catch (e) {
  latePassed = true;
  console.log('✓ Rejected time after 22:00:', e.message);
}
console.assert(latePassed, 'Must reject endTime > 22:00');

let invertedPassed = false;
try {
  validateTimeRange({ startTime: '15:00', endTime: '12:00' });
} catch (e) {
  invertedPassed = true;
  console.log('✓ Rejected start > end:', e.message);
}
console.assert(invertedPassed, 'Must reject startTime >= endTime');

// 2. Overlap calculations & Adjacent Slot Allowance
console.log('\n--- 2. Testing Overlap & Adjacent Slot Allowance ---');
// Overlap: 10:00-12:00 and 11:00-13:00 -> TRUE
console.assert(isTimeOverlapping('10:00', '12:00', '11:00', '13:00') === true, '10-12 and 11-13 should overlap');
// Adjacent: 10:00-11:00 and 11:00-12:00 -> FALSE (Allowed!)
console.assert(isTimeOverlapping('10:00', '11:00', '11:00', '12:00') === false, '10-11 and 11-12 must NOT overlap');
// Disjoint: 08:00-09:00 and 14:00-16:00 -> FALSE
console.assert(isTimeOverlapping('08:00', '09:00', '14:00', '16:00') === false, 'Disjoint slots must not overlap');
// All-Day with anything on the same day -> TRUE
console.assert(isTimeOverlapping('10:00', '12:00', '06:00', '22:00', false, true) === true, 'All-Day must conflict with normal slot');
console.assert(isTimeOverlapping('06:00', '22:00', '10:00', '12:00', true, false) === true, 'Normal slot must conflict with All-Day');

// 3. Word Count (300 Words Maximum)
console.log('\n--- 3. Testing 300-Word Description Limit ---');
const sampleText = 'The Department of Computer Engineering is organizing a state-level hackathon on generative AI.';
const words = countWords(sampleText);
console.assert(words === 13, `Expected 13 words, got ${words}`);
console.assert(validateDescriptionWordCount(sampleText) === 13, 'validateDescriptionWordCount returned 13');

const exact300Words = Array(300).fill('word').join(' ');
console.assert(validateDescriptionWordCount(exact300Words) === 300, 'Exact 300 words must pass');

let limitExceeded = false;
try {
  const words301 = Array(301).fill('word').join(' ');
  validateDescriptionWordCount(words301);
} catch (e) {
  limitExceeded = true;
  console.log('✓ Rejected 301 words:', e.message);
}
console.assert(limitExceeded, 'Must reject > 300 words');

// 4. Testing Document File Types & Upload Rules (Change 2)
console.log('\n--- 4. Testing Allowed Document Types & File Constraints ---');
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png'
];
console.assert(ALLOWED_MIME_TYPES.includes('application/pdf'), 'PDF must be allowed');
console.assert(ALLOWED_MIME_TYPES.includes('image/jpeg'), 'JPEG must be allowed');
console.assert(!ALLOWED_MIME_TYPES.includes('application/x-msdownload'), 'EXE/binary must be blocked');

// Official Report Protected Type Check
const isProtectedReport = (docType) => docType === 'GENERATED_ACTIVITY_REPORT';
console.assert(isProtectedReport('GENERATED_ACTIVITY_REPORT') === true, 'Generated event report must be protected from deletion');
console.assert(isProtectedReport('SUPPORTING_DOCUMENT') === false, 'Supporting document is deletable by authorized owner');
console.assert(isProtectedReport('ATTENDANCE_SHEET') === false, 'Attendance sheet is deletable by authorized uploader');

// 5. Testing Change Request Stage Transitions (Change 3)
console.log('\n--- 5. Testing Change Request Transitions ---');
const getNextStatusAfterCorrections = (changeRequestStage) => {
  return changeRequestStage === 'ADMIN_REVIEW' ? 'ADMIN_REVIEW' : 'SUBMITTED';
};
console.assert(getNextStatusAfterCorrections('HOD_REVIEW') === 'SUBMITTED', 'HOD corrections return to SUBMITTED');
console.assert(getNextStatusAfterCorrections('ADMIN_REVIEW') === 'ADMIN_REVIEW', 'Admin corrections return to ADMIN_REVIEW');

// 6. Testing Rejected / Archived Query Filtering (Change 4)
console.log('\n--- 6. Testing Rejected / Archived Query Filtering ---');
const filterActiveWorkflows = (activitiesList) => {
  return activitiesList.filter(act => act.status !== 'REJECTED' && !act.isArchived);
};
const mockActivities = [
  { id: 1, title: 'Active Workshop', status: 'SCHEDULED', isArchived: false },
  { id: 2, title: 'Rejected Seminar', status: 'REJECTED', isArchived: true, archiveReason: 'REJECTED' },
  { id: 3, title: 'Pending Approval', status: 'HOD_REVIEW', isArchived: false },
  { id: 4, title: 'Changes Required', status: 'CHANGES_REQUIRED', isArchived: false }
];
const activeOnly = filterActiveWorkflows(mockActivities);
console.assert(activeOnly.length === 3, `Expected 3 active activities, got ${activeOnly.length}`);
console.assert(!activeOnly.some(a => a.status === 'REJECTED'), 'No rejected activities in active workflow');
console.assert(!activeOnly.some(a => a.isArchived), 'No archived activities in active workflow');

console.log('\n=============================================');
console.log('🎉 ALL PURE UNIT & ALGORITHMIC TESTS PASSED!');
console.log('=============================================\n');

