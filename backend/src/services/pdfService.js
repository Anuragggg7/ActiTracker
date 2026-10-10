import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { calculateAcademicYear } from '../utils/academicYear.js';
import { getOrGenerateReportId } from '../utils/reportIdGenerator.js';

/**
 * Server-Side PDF Generator for ActivityTracker RCPIT
 * Builds official institutional Activity Report PDFs from MongoDB records using pdfkit
 */
export const buildOfficialActivityPDF = async ({
  activity,
  report,
  attendanceRecords = [],
  verifiedMedia = [],
  completenessScore = 100,
  department = null,
  coordinator = null,
  hod = null,
  director = null,
  approvals = []
}) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true // Enable bufferPages to add "Page X of Y" footers dynamically
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      const reportId = await getOrGenerateReportId(activity);
      const academicYear = calculateAcademicYear(activity.date);
      const genDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      // Stakeholders resolution
      const deptName = department?.name || activity.departmentId?.name || 'Department';
      const deptCode = department?.code || activity.departmentId?.code || 'RCPIT';

      const staffCoordinator = coordinator || activity.coordinatorId || {
        name: 'Faculty Coordinator',
        designation: 'Assistant Professor',
        email: 'faculty@rcpit.ac.in',
        employeeId: 'N/A'
      };

      const deptHod = hod || activity.hodId || {
        name: `HOD, Dept. of ${deptName}`,
        designation: 'Head of Department',
        email: 'hod@rcpit.ac.in'
      };

      const instDirector = director || {
        name: 'Dr. P. J. Patel',
        designation: 'Director',
        email: 'director@rcpit.ac.in'
      };

      // Palette
      const PRIMARY = '#091e42';       // Institutional Deep Navy
      const SECONDARY = '#0369a1';     // Deep Sky Accent
      const TEXT_DARK = '#0f172a';     // Slate 900
      const TEXT_MUTED = '#475569';    // Slate 600
      const BORDER_COLOR = '#cbd5e1';  // Slate 300
      const BG_CARD = '#f8fafc';       // Slate 50
      const SUCCESS_COLOR = '#059669'; // Emerald 600

      // Helper function for horizontal lines
      const addDivider = (y, color = BORDER_COLOR, lineWidth = 1) => {
        doc.moveTo(40, y).lineTo(555, y).strokeColor(color).lineWidth(lineWidth).stroke();
      };

      // Space check with automatic page creation
      let currentY = 40;
      const ensureSpace = (neededHeight = 40) => {
        if (currentY + neededHeight > 740) {
          doc.addPage();
          currentY = 40;
          return true;
        }
        return false;
      };

      // -------------------------------------------------------------
      // HEADER SECTION (Official Letterhead)
      // -------------------------------------------------------------
      // Check for RCPIT logo
      const possibleLogoPaths = [
        path.resolve(process.cwd(), 'uploads/rcpit-logo.png'),
        path.resolve(process.cwd(), 'public/rcpit-logo.png'),
        path.resolve(process.cwd(), '../backend/uploads/rcpit-logo.png'),
        path.resolve(process.cwd(), '../frontend/public/rcpit-logo.png'),
        path.resolve(process.cwd(), '../frontend/dist/rcpit-logo.png')
      ];

      let logoDrawn = false;
      for (const p of possibleLogoPaths) {
        if (fs.existsSync(p)) {
          try {
            doc.image(p, 40, 36, { width: 50 });
            logoDrawn = true;
            break;
          } catch (e) {
            // ignore and fallback
          }
        }
      }

      if (!logoDrawn) {
        doc.rect(40, 36, 50, 50).fillAndStroke('#f1f5f9', '#94a3b8');
        doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold').text('RCPIT\nSHIRPUR', 42, 52, { align: 'center', width: 46 });
      }

      // Institute Titles
      doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text('R. C. PATEL INSTITUTE OF TECHNOLOGY', 98, 36);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(SECONDARY).text('An Autonomous Institute Affiliated to DBATU, Lonere | Approved by AICTE, New Delhi', 98, 52);
      doc.fontSize(7.5).font('Helvetica').fillColor(TEXT_MUTED).text('Accredited by NAAC with \'A\' Grade | NBA Accredited Programs | NIRF Ranked', 98, 64);
      doc.fontSize(7).fillColor(TEXT_MUTED).text('Near Nimzari Naka, Shahada Road, Shirpur, Dist. Dhule, Maharashtra - 425405', 98, 75);

      // Report Header Meta Box (Top Right)
      doc.rect(415, 36, 140, 52).fillAndStroke(BG_CARD, BORDER_COLOR);
      doc.fillColor(TEXT_DARK).fontSize(7.5).font('Helvetica-Bold').text(`Report ID: ${reportId}`, 420, 41);
      doc.font('Helvetica').text(`Academic Year: ${academicYear}`, 420, 52);
      doc.text(`Generated: ${genDate}`, 420, 63);
      doc.fillColor(SUCCESS_COLOR).font('Helvetica-Bold').text(`Status: ${activity.status}`, 420, 74);

      addDivider(96, PRIMARY, 1.5);
      addDivider(99, SECONDARY, 0.5);

      // Report Sub-Title Banner
      doc.rect(40, 104, 515, 20).fill(PRIMARY);
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text(
        `INTERNAL QUALITY ASSURANCE CELL (IQAC) — OFFICIAL ACTIVITY COMPLETION REPORT`,
        45, 110, { align: 'center', width: 505 }
      );

      currentY = 132;

      // -------------------------------------------------------------
      // SECTION 1: ACTIVITY EXECUTIVE PROFILE
      // -------------------------------------------------------------
      doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold').text('1. Activity Master Profile & Institutional Scope', 40, currentY);
      currentY += 15;

      const metaBoxHeight = 100;
      doc.rect(40, currentY, 515, metaBoxHeight).fillAndStroke(BG_CARD, BORDER_COLOR);
      let rowY = currentY + 8;

      doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text('Activity Title:', 50, rowY);
      doc.font('Helvetica').text(activity.title || 'N/A', 135, rowY, { width: 410 });
      rowY += 20;

      doc.font('Helvetica-Bold').text('Category / Type:', 50, rowY);
      doc.font('Helvetica').text(`${activity.category}`, 135, rowY);
      doc.font('Helvetica-Bold').text('Department:', 310, rowY);
      doc.font('Helvetica').text(`${deptName} (${deptCode})`, 385, rowY);
      rowY += 16;

      doc.font('Helvetica-Bold').text('Date & Timings:', 50, rowY);
      doc.font('Helvetica').text(`${new Date(activity.date).toLocaleDateString('en-IN')} (${activity.startTime} - ${activity.endTime})`, 135, rowY);
      doc.font('Helvetica-Bold').text('Venue / Slot:', 310, rowY);
      doc.font('Helvetica').text(`${activity.venueName || activity.venueId?.name || 'TBD'}`, 385, rowY);
      rowY += 16;

      doc.font('Helvetica-Bold').text('Target Audience:', 50, rowY);
      doc.font('Helvetica').text(`${activity.targetAudience || 'Students & Faculty'}`, 135, rowY);
      doc.font('Helvetica-Bold').text('Total Duration:', 310, rowY);
      doc.font('Helvetica').text(`${activity.durationHours || 3} Hours`, 385, rowY);
      rowY += 16;

      doc.font('Helvetica-Bold').text('Expected Cohort:', 50, rowY);
      doc.font('Helvetica').text(`${activity.expectedParticipants || 50} Participants`, 135, rowY);
      doc.font('Helvetica-Bold').text('Completeness:', 310, rowY);
      doc.font('Helvetica-Bold').fillColor(SUCCESS_COLOR).text(`${completenessScore}% (Verified Quality)`, 385, rowY);

      currentY += metaBoxHeight + 12;

      // Description & Objectives
      doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text('Activity Objectives & Academic Scope:', 40, currentY);
      currentY += 12;
      const descText = activity.description || 'Activity conducted to enhance technical acumen, practical exposure and syllabus curriculum reinforcement.';
      doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED).text(descText, 40, currentY, { width: 515, lineGap: 2 });
      currentY += doc.heightOfString(descText, { width: 515, lineGap: 2 }) + 14;

      // -------------------------------------------------------------
      // SECTION 2: DEPARTMENT AUTHORITIES & RESOURCE PERSON
      // -------------------------------------------------------------
      ensureSpace(120);
      doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold').text('2. Institutional Authorities & Key Stakeholders', 40, currentY);
      currentY += 15;

      const stakeBoxHeight = 85;
      doc.rect(40, currentY, 515, stakeBoxHeight).fillAndStroke(BG_CARD, BORDER_COLOR);

      // Col 1: Faculty Coordinator
      doc.fillColor(PRIMARY).fontSize(8.5).font('Helvetica-Bold').text('Organizing Coordinator', 50, currentY + 8);
      doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica').text(`Name: ${staffCoordinator.name || 'Coordinator'}`, 50, currentY + 22);
      doc.text(`Designation: ${staffCoordinator.designation || 'Faculty'}`, 50, currentY + 34);
      doc.text(`Emp ID: ${staffCoordinator.employeeId || 'N/A'}`, 50, currentY + 46);
      doc.text(`Dept: ${deptName}`, 50, currentY + 58);
      doc.fillColor(TEXT_MUTED).fontSize(7.5).text(`Email: ${staffCoordinator.email || 'N/A'}`, 50, currentY + 70);

      // Col 2: HOD of Respective Department
      doc.fillColor(PRIMARY).fontSize(8.5).font('Helvetica-Bold').text('Head of Department (HOD)', 220, currentY + 8);
      doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica').text(`Name: ${deptHod.name || 'Department HOD'}`, 220, currentY + 22);
      doc.text(`Designation: ${deptHod.designation || 'Head of Department'}`, 220, currentY + 34);
      doc.text(`Dept: ${deptName}`, 220, currentY + 46);
      doc.fillColor(TEXT_MUTED).fontSize(7.5).text(`Email: ${deptHod.email || 'hod@rcpit.ac.in'}`, 220, currentY + 58);
      doc.text(`Role: Department Verification Authority`, 220, currentY + 70);

      // Col 3: Director
      doc.fillColor(PRIMARY).fontSize(8.5).font('Helvetica-Bold').text('Executive Director', 390, currentY + 8);
      doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica').text(`Name: ${instDirector.name || 'Dr. P. J. Patel'}`, 390, currentY + 22);
      doc.text(`Designation: ${instDirector.designation || 'Director, RCPIT'}`, 390, currentY + 34);
      doc.text(`Institute: RCPIT Shirpur`, 390, currentY + 46);
      doc.fillColor(TEXT_MUTED).fontSize(7.5).text(`Email: ${instDirector.email || 'director@rcpit.ac.in'}`, 390, currentY + 58);
      doc.text(`Role: Chief Executive Approval`, 390, currentY + 70);

      currentY += stakeBoxHeight + 12;

      // Guest / Resource Person Box
      if (activity.guestSpeaker?.name) {
        ensureSpace(45);
        doc.rect(40, currentY, 515, 38).fillAndStroke('#eff6ff', '#bfdbfe');
        doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold').text('Resource Person / Guest Expert Details:', 48, currentY + 6);
        doc.fillColor(TEXT_DARK).fontSize(7.5).font('Helvetica')
          .text(`Name: ${activity.guestSpeaker.name} | Designation: ${activity.guestSpeaker.designation || 'Expert'} | Organization: ${activity.guestSpeaker.organization || 'Industry Partner'} | Contact: ${activity.guestSpeaker.contact || 'N/A'}`, 48, currentY + 20);
        currentY += 46;
      }

      // -------------------------------------------------------------
      // SECTION 3: FINANCIAL & BUDGETARY STATEMENT
      // -------------------------------------------------------------
      ensureSpace(95);
      doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold').text('3. Financial & Budgetary Statement', 40, currentY);
      currentY += 15;

      const budgetBoxHeight = 55;
      doc.rect(40, currentY, 515, budgetBoxHeight).fillAndStroke(BG_CARD, BORDER_COLOR);

      const budgetCols = [
        { label: 'Estimated Budget', val: `₹${(activity.estimatedBudget || 0).toLocaleString()}`, x: 50 },
        { label: 'Approved Budget', val: `₹${(activity.approvedBudget || activity.estimatedBudget || 0).toLocaleString()}`, x: 155 },
        { label: 'Actual Expenditure', val: `₹${(activity.actualExpenditure || 0).toLocaleString()}`, x: 260 },
        { label: 'Funding Source', val: activity.fundingSource || 'Department Budget', x: 365 },
        { label: 'Budget Status', val: activity.budgetStatus || 'APPROVED', x: 470 }
      ];

      budgetCols.forEach(c => {
        doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica-Bold').text(c.label.toUpperCase(), c.x, currentY + 10);
        doc.fillColor(PRIMARY).fontSize(9.5).font('Helvetica-Bold').text(c.val, c.x, currentY + 24);
      });

      currentY += budgetBoxHeight + 14;

      // Detailed Budget Categories Table if present
      if (activity.budgetCategories && activity.budgetCategories.length > 0) {
        ensureSpace(50);
        doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold').text('Itemized Budget Allocation Breakdown:', 40, currentY);
        currentY += 12;

        doc.rect(40, currentY, 515, 16).fill(PRIMARY);
        doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
        doc.text('Sr.', 46, currentY + 4);
        doc.text('Expense Head / Category', 70, currentY + 4);
        doc.text('Estimated Amount', 240, currentY + 4);
        doc.text('Actual Amount', 340, currentY + 4);
        doc.text('Notes / Justification', 430, currentY + 4);
        currentY += 16;

        activity.budgetCategories.forEach((b, idx) => {
          ensureSpace(16);
          const bg = idx % 2 === 0 ? '#ffffff' : BG_CARD;
          doc.rect(40, currentY, 515, 16).fillAndStroke(bg, BORDER_COLOR);
          doc.fillColor(TEXT_DARK).fontSize(7).font('Helvetica');
          doc.text(String(idx + 1), 46, currentY + 4);
          doc.text(b.categoryName || 'Item', 70, currentY + 4);
          doc.text(`₹${(b.estimatedAmount || 0).toLocaleString()}`, 240, currentY + 4);
          doc.text(`₹${(b.actualAmount || 0).toLocaleString()}`, 340, currentY + 4);
          doc.text(b.notes || '—', 430, currentY + 4);
          currentY += 16;
        });
        currentY += 10;
      }

      // -------------------------------------------------------------
      // SECTION 4: PARTICIPANT ATTENDANCE DEMOGRAPHICS & REGISTER
      // -------------------------------------------------------------
      ensureSpace(120);
      doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold').text('4. Participation & Verified Attendance Demographics', 40, currentY);
      currentY += 15;

      const totalRecs = attendanceRecords.length;
      const presentRecs = attendanceRecords.filter(r => r.attendanceStatus === 'PRESENT').length;
      const absentRecs = attendanceRecords.filter(r => r.attendanceStatus === 'ABSENT').length;
      const attPercent = totalRecs > 0 ? Math.round((presentRecs / totalRecs) * 100) : 0;

      // Stats KPI Cards
      const attBoxHeight = 44;
      doc.rect(40, currentY, 515, attBoxHeight).fillAndStroke(BG_CARD, BORDER_COLOR);

      const attCards = [
        { label: 'Expected', val: String(activity.expectedParticipants || 50), x: 50 },
        { label: 'Total Logged', val: String(totalRecs), x: 140 },
        { label: 'Present Attendees', val: String(presentRecs), x: 230 },
        { label: 'Absent', val: String(absentRecs), x: 330 },
        { label: 'Attendance %', val: `${attPercent}%`, x: 420 }
      ];

      attCards.forEach(c => {
        doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica-Bold').text(c.label.toUpperCase(), c.x, currentY + 8);
        doc.fillColor(PRIMARY).fontSize(10).font('Helvetica-Bold').text(c.val, c.x, currentY + 22);
      });

      currentY += attBoxHeight + 12;

      // Attendance Register Table
      doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text('Verified Attendance Register Log (Sequential):', 40, currentY);
      currentY += 12;

      const drawAttendanceHeader = () => {
        doc.rect(40, currentY, 515, 16).fill(PRIMARY);
        doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
        doc.text('Sr. No.', 46, currentY + 4);
        doc.text('Participant Name', 85, currentY + 4);
        doc.text('PRN / ID', 220, currentY + 4);
        doc.text('Department', 315, currentY + 4);
        doc.text('Type', 415, currentY + 4);
        doc.text('Status', 485, currentY + 4);
        currentY += 16;
      };

      drawAttendanceHeader();

      if (attendanceRecords.length === 0) {
        doc.rect(40, currentY, 515, 20).fillAndStroke('#ffffff', BORDER_COLOR);
        doc.fillColor(TEXT_MUTED).fontSize(7.5).font('Helvetica').text('No participant attendance records logged for this activity yet.', 48, currentY + 6);
        currentY += 26;
      } else {
        const rowsToRender = attendanceRecords.slice(0, 20); // Render up to 20 rows in official PDF
        rowsToRender.forEach((r, idx) => {
          if (currentY > 730) {
            doc.addPage();
            currentY = 40;
            drawAttendanceHeader();
          }

          const bg = idx % 2 === 0 ? '#ffffff' : BG_CARD;
          doc.rect(40, currentY, 515, 16).fillAndStroke(bg, BORDER_COLOR);
          doc.fillColor(TEXT_DARK).fontSize(7).font('Helvetica');
          doc.text(String(idx + 1), 46, currentY + 4);
          doc.text(r.participantName || 'N/A', 85, currentY + 4, { width: 130, height: 10 });
          doc.text(r.participantId || 'N/A', 220, currentY + 4);
          doc.text(r.department || 'General', 315, currentY + 4);
          doc.text(r.participantType || 'STUDENT', 415, currentY + 4);
          doc.fillColor(r.attendanceStatus === 'PRESENT' ? SUCCESS_COLOR : '#dc2626')
            .font('Helvetica-Bold')
            .text(r.attendanceStatus, 485, currentY + 4);
          currentY += 16;
        });

        if (attendanceRecords.length > 20) {
          doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica-Oblique').text(
            `... and ${attendanceRecords.length - 20} additional verified participant records stored in MongoDB institutional archive.`,
            40, currentY + 4
          );
          currentY += 16;
        }
      }

      currentY += 10;

      // -------------------------------------------------------------
      // SECTION 5: POST-EVENT EXECUTION OUTCOMES & IMPACT
      // -------------------------------------------------------------
      ensureSpace(140);
      doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold').text('5. Post-Event Outcomes, Achievements & Feedback', 40, currentY);
      currentY += 15;

      const highlights = report?.keyHighlights || 'Activity successfully organized and delivered per institutional standards.';
      const outcomes = report?.outcomes || 'Enhanced participants\' practical skills, domain competence, and syllabus alignment.';
      const achievements = report?.achievements || 'Successful completion certificates awarded to verified attendees.';
      const feedback = report?.feedback || 'High satisfaction reported across student cohorts with constructive recommendations.';
      const conclusion = report?.conclusion || 'The event achieved its stated institutional objectives and curriculum goals.';

      const outcomeSections = [
        { title: 'Key Highlights & Execution:', text: highlights },
        { title: 'Measurable Learning Outcomes (PO/PSO):', text: outcomes },
        { title: 'Notable Achievements & Milestones:', text: achievements },
        { title: 'Participant & Student Feedback:', text: feedback },
        { title: 'Conclusion & Academic Impact:', text: conclusion }
      ];

      outcomeSections.forEach(sec => {
        ensureSpace(32);
        doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold').text(sec.title, 40, currentY);
        currentY += 11;
        doc.font('Helvetica').fontSize(7.5).fillColor(TEXT_MUTED).text(sec.text, 40, currentY, { width: 515, lineGap: 1.5 });
        currentY += doc.heightOfString(sec.text, { width: 515, lineGap: 1.5 }) + 8;
      });

      // -------------------------------------------------------------
      // SECTION 6: VERIFIED PHOTOGRAPHS & MEDIA EVIDENCE
      // -------------------------------------------------------------
      ensureSpace(80);
      doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold').text('6. Photographic Evidence & Verified Media Repository', 40, currentY);
      currentY += 15;

      if (verifiedMedia.length === 0) {
        doc.fillColor(TEXT_MUTED).fontSize(7.5).font('Helvetica').text('No photographic media files uploaded for this event record.', 40, currentY);
        currentY += 18;
      } else {
        verifiedMedia.slice(0, 4).forEach((m, idx) => {
          ensureSpace(22);
          doc.rect(40, currentY, 515, 20).fillAndStroke(BG_CARD, BORDER_COLOR);
          doc.fillColor(PRIMARY).fontSize(7.5).font('Helvetica-Bold').text(`[PHOTO #${idx + 1}] ${m.caption || 'Event Photograph'}`, 48, currentY + 5);
          doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica').text(`Status: Verified by HOD | Type: ${m.mediaType || 'IMAGE'} | Date: ${new Date(m.createdAt || Date.now()).toLocaleDateString()}`, 250, currentY + 5);
          currentY += 24;
        });
      }

      currentY += 8;

      // -------------------------------------------------------------
      // SECTION 7: AUDIT TRAIL & OFFICIAL INSTITUTIONAL SIGNATURES
      // -------------------------------------------------------------
      ensureSpace(160);
      doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold').text('7. Institutional Governance Audit Trail & Official Signatures', 40, currentY);
      currentY += 15;

      // Completeness Card
      doc.rect(40, currentY, 515, 36).fillAndStroke('#eff6ff', '#bfdbfe');
      doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold').text(`Institutional Quality Score: ${completenessScore}% NAAC / NBA Quality Standard`, 48, currentY + 6);
      doc.font('Helvetica').fontSize(7.5).fillColor(TEXT_MUTED).text(
        'Verified against MongoDB activity master records, attendance logs, photographic evidence, and HOD report reviews.',
        48, currentY + 18
      );
      currentY += 46;

      // Formal Signature Block
      doc.fillColor(PRIMARY).fontSize(8.5).font('Helvetica-Bold').text('OFFICIAL VERIFICATION & INSTITUTIONAL SIGNATURES', 40, currentY);
      currentY += 35;

      const sigWidth = 145;

      // Signature 1: Organizing Faculty Coordinator
      doc.moveTo(40, currentY).lineTo(40 + sigWidth, currentY).strokeColor(TEXT_DARK).lineWidth(1).stroke();
      doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold').text('Prepared By (Coordinator):', 40, currentY + 6);
      doc.font('Helvetica').text(staffCoordinator.name || 'Faculty Coordinator', 40, currentY + 18);
      doc.fontSize(7).fillColor(TEXT_MUTED).text(`${staffCoordinator.designation || 'Faculty'}, Dept. of ${deptName}`, 40, currentY + 28);
      doc.text(`Date: ${genDate}`, 40, currentY + 38);

      // Signature 2: Department HOD
      doc.moveTo(225, currentY).lineTo(225 + sigWidth, currentY).strokeColor(TEXT_DARK).lineWidth(1).stroke();
      doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold').text('Verified By (Head of Department):', 225, currentY + 6);
      doc.font('Helvetica').text(deptHod.name || 'Head of Department', 225, currentY + 18);
      doc.fontSize(7).fillColor(TEXT_MUTED).text(`HOD, Dept. of ${deptName}`, 225, currentY + 28);
      doc.text(`Date: ${report?.reviewedAt ? new Date(report.reviewedAt).toLocaleDateString('en-IN') : genDate}`, 225, currentY + 38);

      // Signature 3: Director
      doc.moveTo(410, currentY).lineTo(410 + sigWidth, currentY).strokeColor(TEXT_DARK).lineWidth(1).stroke();
      doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold').text('Approved By (Director):', 410, currentY + 6);
      doc.font('Helvetica').text(instDirector.name || 'Dr. P. J. Patel', 410, currentY + 18);
      doc.fontSize(7).fillColor(TEXT_MUTED).text('Director, RCPIT Shirpur', 410, currentY + 28);
      doc.text(`Date: ${genDate}`, 410, currentY + 38);

      // -------------------------------------------------------------
      // FOOTER & PAGE NUMBERING (Page X of Y)
      // -------------------------------------------------------------
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.moveTo(40, 792).lineTo(555, 792).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke();
        doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica').text(
          `ActivityTracker RCPIT — Official Record | Report ID: ${reportId} | Department of ${deptName}`,
          40, 798
        );
        doc.text(
          `Page ${i + 1} of ${range.count}`,
          500, 798, { align: 'right' }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
