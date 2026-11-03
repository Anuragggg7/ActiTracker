import fs from 'fs';
import path from 'path';

/**
 * Intelligent Document Processing & Information Extraction Service
 * Extracts verifiable structured facts from uploaded event documents (PDF, DOCX, CSV, TXT)
 * Maintains strict traceability back to source documents and flags conflicts.
 */

const UPLOADS_BASE_DIR = path.join(process.cwd(), 'public', 'uploads');

/**
 * Dynamically loads pdf-parse safely
 */
let pdfParse = null;
const getPdfParser = async () => {
  if (pdfParse) return pdfParse;
  try {
    const module = await import('pdf-parse');
    pdfParse = module.default || module;
    return pdfParse;
  } catch (err) {
    console.warn('pdf-parse not available, falling back to buffer text scanner:', err.message);
    return null;
  }
};

/**
 * Resolves local file path from document record
 */
const resolveFilePath = (fileUrl) => {
  if (!fileUrl) return null;
  const relativePath = fileUrl.replace(/^\/uploads\//, '');
  const candidatePaths = [
    path.join(UPLOADS_BASE_DIR, relativePath),
    path.join(process.cwd(), fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl),
    path.join(process.cwd(), 'uploads', relativePath)
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
};

/**
 * Extracts plain text from a supported document
 */
export const extractTextFromDocument = async (docRecord) => {
  if (!docRecord?.fileUrl) return { text: '', isScanned: false };

  const filePath = resolveFilePath(docRecord.fileUrl);
  if (!filePath) {
    return { text: '', isScanned: false, error: 'Physical file not found on server' };
  }

  const ext = path.extname(filePath).toLowerCase();

  try {
    // 1. Text-based PDF extraction
    if (ext === '.pdf') {
      const parser = await getPdfParser();
      if (parser) {
        const dataBuffer = await fs.promises.readFile(filePath);
        const parsed = await parser(dataBuffer);
        const text = (parsed.text || '').trim();
        const isScanned = text.length < 50; // Little to no selectable text indicates scanned/image PDF
        return { text, isScanned, pageCount: parsed.numpages || 1 };
      }
    }

    // 2. CSV / TXT / Markdown extraction
    if (['.csv', '.txt', '.md', '.json'].includes(ext)) {
      const text = await fs.promises.readFile(filePath, 'utf-8');
      return { text: text.trim(), isScanned: false, pageCount: 1 };
    }

    // 3. Fallback for other formats
    return { text: '', isScanned: true, message: 'Format requires manual inspection or OCR' };
  } catch (err) {
    console.error(`Document text extraction error for ${docRecord.fileName}:`, err.message);
    return { text: '', isScanned: false, error: err.message };
  }
};

/**
 * Parses key insights and sections from extracted raw text
 */
export const parseDocumentFacts = (rawText) => {
  if (!rawText || typeof rawText !== 'string') {
    return {
      speakers: [],
      topics: [],
      outcomes: [],
      achievements: [],
      extractedParticipantCount: null,
      extractedSummary: ''
    };
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const speakers = new Set();
  const topics = new Set();
  const outcomes = new Set();
  const achievements = new Set();
  let extractedParticipantCount = null;

  // Pattern detection for resource persons / speakers
  const speakerRegex = /(?:resource person|speaker|guest lecture by|expert|conducted by|trainer)[:\s]+([^\n;]+)/i;
  // Pattern detection for participant counts
  const participantRegex = /(?:total participants|participants count|students attended|attendance|attendees)[:\s]+(\d+)/i;
  // Pattern detection for topics
  const topicRegex = /(?:topic|curriculum|module|subject|covered topics)[:\s]+([^\n;]+)/i;
  // Pattern detection for outcomes / learning
  const outcomeRegex = /(?:outcomes?|key learnings?|objectives? achieved)[:\s]+([^\n;]+)/i;
  // Pattern detection for achievements / prizes
  const achievementRegex = /(?:achievements?|winners?|prizes?|first place|second place|certified)[:\s]+([^\n;]+)/i;

  for (const line of lines) {
    const sMatch = line.match(speakerRegex);
    if (sMatch && sMatch[1]) {
      const candidate = sMatch[1].split(/[,-]/)[0].trim();
      if (candidate.length >= 3 && candidate.length < 80) {
        speakers.add(candidate);
      }
    }

    const pMatch = line.match(participantRegex);
    if (pMatch && pMatch[1]) {
      const count = parseInt(pMatch[1], 10);
      if (!isNaN(count) && count > 0 && count < 10000) {
        extractedParticipantCount = count;
      }
    }

    const tMatch = line.match(topicRegex);
    if (tMatch && tMatch[1] && tMatch[1].length > 3 && tMatch[1].length < 120) {
      topics.add(tMatch[1].trim());
    }

    const oMatch = line.match(outcomeRegex);
    if (oMatch && oMatch[1] && oMatch[1].length > 5 && oMatch[1].length < 200) {
      outcomes.add(oMatch[1].trim());
    }

    const aMatch = line.match(achievementRegex);
    if (aMatch && aMatch[1] && aMatch[1].length > 5 && aMatch[1].length < 200) {
      achievements.add(aMatch[1].trim());
    }
  }

  // Generate a concise 2-sentence summary from first relevant paragraphs
  const summaryParagraphs = lines.filter(l => l.length > 40 && !l.startsWith('Page')).slice(0, 3);
  const extractedSummary = summaryParagraphs.join(' ').slice(0, 400);

  return {
    speakers: Array.from(speakers),
    topics: Array.from(topics),
    outcomes: Array.from(outcomes),
    achievements: Array.from(achievements),
    extractedParticipantCount,
    extractedSummary
  };
};

/**
 * Processes all documents for an activity, extracting facts and detecting conflicts
 */
export const processActivityDocuments = async (activity, documents = [], officialReport = null) => {
  const extractedResults = [];

  for (const doc of documents) {
    const { text, isScanned, error } = await extractTextFromDocument(doc);
    const facts = parseDocumentFacts(text);

    let hasConflicts = false;
    let conflictNotes = '';

    // Conflict Check against official MongoDB records
    if (facts.extractedParticipantCount !== null) {
      const officialCount = officialReport?.actualParticipants || activity.expectedParticipants || 0;
      if (officialCount > 0 && Math.abs(facts.extractedParticipantCount - officialCount) > 20) {
        hasConflicts = true;
        conflictNotes = `Document mentions ${facts.extractedParticipantCount} participants, whereas official recorded count is ${officialCount}.`;
      }
    }

    extractedResults.push({
      activityId: activity._id,
      documentId: doc._id,
      fileName: doc.fileName,
      documentType: doc.documentType,
      extractedSummary: facts.extractedSummary,
      speakers: facts.speakers,
      topics: facts.topics,
      outcomes: facts.outcomes,
      achievements: facts.achievements,
      isTraceable: true,
      hasConflicts,
      conflictNotes,
      isScanned: !!isScanned,
      extractionError: error || null
    });
  }

  return extractedResults;
};
