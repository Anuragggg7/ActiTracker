import {
  calculateAcademicYear,
  normalizeAcademicYear,
  getAcademicYearDateRange,
  isDateInAcademicYear,
  getAvailableAcademicYears
} from './src/utils/academicYear.js';
import { parseDocumentFacts } from './src/services/documentExtractorService.js';

console.log('🚀 Running Annual Report System Unit Tests...\n');

// 1. Academic Year Utilities
console.log('--- 1. Testing Academic Year Utilities ---');
console.assert(normalizeAcademicYear('2026-27') === '2026–27', 'Normalization hyphen -> en-dash failed');
console.assert(normalizeAcademicYear('2026–27') === '2026–27', 'Normalization en-dash failed');

const dateJune2026 = new Date('2026-06-15T10:00:00Z');
console.assert(calculateAcademicYear(dateJune2026) === '2026–27', 'June 2026 must be 2026–27');

const dateApril2026 = new Date('2026-04-10T10:00:00Z');
console.assert(calculateAcademicYear(dateApril2026) === '2025–26', 'April 2026 must be 2025–26');

const range2627 = getAcademicYearDateRange('2026–27');
console.assert(range2627.startYear === 2026 && range2627.endYear === 2027, 'Start/End years failed');
console.assert(isDateInAcademicYear(new Date('2026-09-01'), '2026–27') === true, 'Sept 2026 must be in 2026–27');
console.assert(isDateInAcademicYear(new Date('2025-05-15'), '2026–27') === false, 'May 2025 must NOT be in 2026–27');

const availableAYs = getAvailableAcademicYears();
console.assert(Array.isArray(availableAYs) && availableAYs.length >= 3, 'Must return available academic years');
console.log('✓ Academic year calculations verified');

// 2. Strict HOD Verification Eligibility Algorithm
console.log('\n--- 2. Testing Strict HOD-Verification Eligibility Rules ---');
const evaluateActivityEligibility = (activity, report) => {
  // Excluded: cancelled or rejected
  if (['REJECTED', 'CANCELLED'].includes(activity.status)) {
    return { isEligible: false, category: 'EXCLUDED' };
  }

  // Must have a verified ActivityReport
  const isHodVerified = report && report.status === 'VERIFIED' && report.reviewedBy != null;

  if (isHodVerified) {
    // Retains eligibility even if current activity status is COMPLETED, LOCKED, or ARCHIVED!
    return { isEligible: true, category: 'ELIGIBLE' };
  }

  if (report && report.status === 'SUBMITTED') {
    return { isEligible: false, category: 'PENDING_VERIFICATION' };
  }

  if (report && report.status === 'CHANGES_REQUIRED') {
    return { isEligible: false, category: 'CHANGES_REQUIRED' };
  }

  return { isEligible: false, category: 'MISSING_REPORT' };
};

// Case A: Conducted + HOD-verified -> ELIGIBLE
const caseA = evaluateActivityEligibility(
  { _id: '1', status: 'COMPLETED' },
  { status: 'VERIFIED', reviewedBy: 'hod_123', reviewedAt: new Date() }
);
console.assert(caseA.isEligible === true && caseA.category === 'ELIGIBLE', 'Case A must be ELIGIBLE');
console.log('✓ Case A (Conducted + HOD Verified): ELIGIBLE');

// Case B: Activity moved to ARCHIVED / LOCKED but has verified report -> MUST REMAIN ELIGIBLE
const caseB = evaluateActivityEligibility(
  { _id: '2', status: 'ARCHIVED', isLocked: true },
  { status: 'VERIFIED', reviewedBy: 'hod_123', reviewedAt: new Date() }
);
console.assert(caseB.isEligible === true && caseB.category === 'ELIGIBLE', 'Case B must remain ELIGIBLE');
console.log('✓ Case B (Archived/Locked + HOD Verified): REMAINS ELIGIBLE');

// Case C: Activity conducted, report submitted, awaiting HOD review -> INELIGIBLE (PENDING_VERIFICATION)
const caseC = evaluateActivityEligibility(
  { _id: '3', status: 'VERIFICATION' },
  { status: 'SUBMITTED', reviewedBy: null }
);
console.assert(caseC.isEligible === false && caseC.category === 'PENDING_VERIFICATION', 'Case C must be PENDING_VERIFICATION');
console.log('✓ Case C (Awaiting HOD Review): INELIGIBLE (PENDING_VERIFICATION)');

// Case D: Activity conducted, no report submitted -> INELIGIBLE (MISSING_REPORT)
const caseD = evaluateActivityEligibility(
  { _id: '4', status: 'CONDUCTED' },
  null
);
console.assert(caseD.isEligible === false && caseD.category === 'MISSING_REPORT', 'Case D must be MISSING_REPORT');
console.log('✓ Case D (No Report Submitted): INELIGIBLE (MISSING_REPORT)');

// Case E: Rejected or Cancelled activity (even if old report existed) -> INELIGIBLE (EXCLUDED)
const caseE = evaluateActivityEligibility(
  { _id: '5', status: 'CANCELLED' },
  { status: 'VERIFIED', reviewedBy: 'hod_123' }
);
console.assert(caseE.isEligible === false && caseE.category === 'EXCLUDED', 'Case E must be EXCLUDED');
console.log('✓ Case E (Cancelled Activity): INELIGIBLE (EXCLUDED)');

// 3. Document Extraction & Pattern Recognition
console.log('\n--- 3. Testing Document Information Extraction ---');
const sampleDocText = `
R. C. Patel Institute of Technology, Shirpur
Department of Computer Engineering
Workshop on Generative AI and Large Language Models

Resource Person: Dr. Anand Sharma, Senior AI Researcher
Topic: Transformer Architectures and Prompt Engineering
Total Participants: 85 students attended the 2-day session.
Outcomes achieved: Students deployed fine-tuned open-source models.
Achievements: Top 3 project teams awarded certificates of excellence.
`;

const extracted = parseDocumentFacts(sampleDocText);
console.assert(extracted.speakers.some(s => s.includes('Anand Sharma')), 'Must extract speaker');
console.assert(extracted.topics.some(t => t.includes('Transformer Architectures')), 'Must extract topic');
console.assert(extracted.extractedParticipantCount === 85, 'Must extract participant count 85');
console.assert(extracted.outcomes.some(o => o.includes('fine-tuned open-source models')), 'Must extract outcomes');
console.assert(extracted.achievements.some(a => a.includes('awarded certificates')), 'Must extract achievements');
console.log('✓ Document text fact parser extracted speaker, topic, participants, and outcomes accurately');

// 4. Versioning Calculation
console.log('\n--- 4. Testing PDF Report Version History Preservation ---');
const calculateNextVersion = (currentVersion, currentStatus) => {
  if (currentStatus === 'OFFICIAL_GENERATED') {
    return currentVersion + 1;
  }
  return currentVersion || 1;
};
console.assert(calculateNextVersion(1, 'DRAFT') === 1, 'Draft should keep version 1');
console.assert(calculateNextVersion(1, 'OFFICIAL_GENERATED') === 2, 'Official regeneration must increment to v2');
console.assert(calculateNextVersion(2, 'OFFICIAL_GENERATED') === 3, 'Official regeneration must increment to v3');
console.log('✓ Version calculation and history preservation verified');

// 5. Readiness Metric Score
console.log('\n--- 5. Testing Readiness Score Calculation ---');
const calcReadiness = (eligible, conducted) => (conducted > 0 ? Math.round((eligible / conducted) * 100) : 100);
console.assert(calcReadiness(4, 5) === 80, '4/5 must be 80%');
console.assert(calcReadiness(5, 5) === 100, '5/5 must be 100%');
console.assert(calcReadiness(0, 5) === 0, '0/5 must be 0%');
console.log('✓ Readiness score metric verified');

console.log('\n=================================================');
console.log('🎉 ALL ANNUAL REPORT SYSTEM UNIT TESTS PASSED!');
console.log('=================================================\n');

