import crypto from 'crypto';
import User from '../models/User.js';

/**
 * Cryptographically Secure Permanent Faculty / Employee ID Generator
 * Generates an immutable institutional ID (format: RCPIT-FAC-2026-XXXXXXXX)
 * Checks MongoDB for zero collision before assignment.
 */
export const generatePermanentFacultyId = async () => {
  const currentYear = new Date().getFullYear();
  let uniqueId = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (!uniqueId && attempts < maxAttempts) {
    attempts++;
    // Generate 8-character uppercase alphanumeric string
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const candidateId = `RCPIT-FAC-${currentYear}-${randomHex}`;

    const existingUser = await User.findOne({ facultyEmployeeId: candidateId });
    if (!existingUser) {
      uniqueId = candidateId;
    }
  }

  if (!uniqueId) {
    // Fallback using timestamp suffix if collision persists
    const fallbackSuffix = Date.now().toString(36).toUpperCase().slice(-8);
    uniqueId = `RCPIT-FAC-${currentYear}-${fallbackSuffix}`;
  }

  return uniqueId;
};
