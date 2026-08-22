import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { calculateAcademicYear } from '../utils/academicYear.js';
import { getOrGenerateReportId } from '../utils/reportIdGenerator.js';

/**
 * Server-Side PDF Generator for ActivityTracker RCPIT
 * Builds official institutional Activity Report PDFs from MongoDB records using pdfkit
 */
export const buildOfficialActivityPDF = async ({ activity, report, attendanceRecords, verifiedMedia, completenessScore }) => {
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

      // Colors
      const PRIMARY = '#091e42';
      const SECONDARY = '#0c75eb';
      const TEXT_DARK = '#172b4d';
      const TEXT_MUTED = '#5e6c84';
      const BORDER_COLOR = '#ebecf0';

      // Helper function for horizontal lines
      const addDivider = (y) => {
        doc.moveTo(40, y).lineTo(555, y).strokeColor(BORDER_COLOR).lineWidth(1).stroke();
      };

      // -------------------------------------------------------------
      // HEADER SECTION
      // -------------------------------------------------------------
      // Logo Placeholder Box
      doc.rect(40, 40, 50, 50).fillAndStroke('#f4f5f7', '#c1c7d0');
      doc.fillColor(PRIMARY).fontSize(8).text('RCPIT\nLOGO', 45, 55, { align: 'center', width: 40 });

      // Title & Subtitle
      doc.fillColor(PRIMARY).fontSize(16).font('Helvetica-Bold').text('R. C. Patel Institute of Technology', 100, 40);
      doc.fontSize(10).font('Helvetica').fillColor(SECONDARY).text('ActivityTracker RCPIT — Official Activity Record', 100, 58);
      doc.fontSize(8).fillColor(TEXT_MUTED).text('An Autonomous Institute Affiliated to DBATU, Lonere | Shirpur, Maharashtra', 100, 72);

      // Report Header Meta Box (Top Right)
      doc.rect(410, 40, 145, 55).fillAndStroke('#f4f5f7', BORDER_COLOR);
      doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold').text(`Report ID: ${reportId}`, 415, 45);
      doc.font('Helvetica').text(`Academic Year: ${academicYear}`, 415, 57);
      doc.text(`Generated: ${genDate}`, 415, 69);
      doc.fillColor('#10b981').text(`Status: ${activity.status}`, 415, 81);

      addDivider(105);

      let currentY = 115;

      // -------------------------------------------------------------
      // SECTION 1: ACTIVITY INFORMATION
      // -------------------------------------------------------------
      doc.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold').text('1. Executive Activity Metadata', 40, currentY);
      currentY += 18;

      doc.rect(40, currentY, 515, 115).fillAndStroke('#fafbfc', BORDER_COLOR);
      let metaY = currentY + 8;

      doc.fillColor(TEXT_DARK).fontSize(9).font('Helvetica-Bold').text('Activity Title:', 50, metaY);
      doc.font('Helvetica').text(activity.title || 'N/A', 140, metaY, { width: 400 });
      metaY += 22;

      doc.font('Helvetica-Bold').text('Category / Type:', 50, metaY);
      doc.font('Helvetica').text(`${activity.category} (${activity.targetAudience || 'General'})`, 140, metaY);
      doc.font('Helvetica-Bold').text('Department:', 320, metaY);
      doc.font('Helvetica').text(activity.departmentId?.name || 'N/A', 390, metaY);
      metaY += 18;

      doc.font('Helvetica-Bold').text('Date & Time:', 50, metaY);
      doc.font('Helvetica').text(`${new Date(activity.date).toLocaleDateString('en-IN')} (${activity.startTime} - ${activity.endTime})`, 140, metaY);
      doc.font('Helvetica-Bold').text('Venue:', 320, metaY);
      doc.font('Helvetica').text(activity.venueName || activity.venueId?.name || 'N/A', 390, metaY);
      metaY += 18;

      doc.font('Helvetica-Bold').text('Coordinator:', 50, metaY);
      doc.font('Helvetica').text(`${activity.coordinatorId?.name || 'N/A'} (${activity.coordinatorId?.designation || 'Faculty'})`, 140, metaY);
      doc.font('Helvetica-Bold').text('Budget:', 320, metaY);
      doc.font('Helvetica').text(`₹${activity.estimatedBudget?.toLocaleString() || 0} (${activity.fundingSource})`, 390, metaY);

      currentY += 125;

      // Description & Objectives
      doc.fillColor(TEXT_DARK).fontSize(9).font('Helvetica-Bold').text('Activity Objectives & Description:', 40, currentY);
      currentY += 14;
      doc.font('Helvetica').fontSize(8.5).fillColor(TEXT_MUTED).text(activity.description || 'No detailed description logged.', 40, currentY, { width: 515 });
      currentY += doc.heightOfString(activity.description || '', { width: 515 }) + 15;

      // -------------------------------------------------------------
      // SECTION 2: GUEST INFORMATION
      // -------------------------------------------------------------
      doc.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold').text('2. Resource Person / Guest Information', 40, currentY);
      currentY += 18;

      if (activity.guestSpeaker?.name) {
        doc.rect(40, currentY, 515, 40).fillAndStroke('#fafbfc', BORDER_COLOR);
        doc.fillColor(TEXT_DARK).fontSize(9).font('Helvetica-Bold').text('Guest Name:', 50, currentY + 8);
        doc.font('Helvetica').text(activity.guestSpeaker.name, 120, currentY + 8);
        doc.font('Helvetica-Bold').text('Designation:', 260, currentY + 8);
        doc.font('Helvetica').text(activity.guestSpeaker.designation || 'N/A', 330, currentY + 8);
        doc.font('Helvetica-Bold').text('Organization:', 50, currentY + 24);
        doc.font('Helvetica').text(activity.guestSpeaker.organization || 'N/A', 120, currentY + 24);
        currentY += 50;
      } else {
        doc.fillColor(TEXT_MUTED).fontSize(9).font('Helvetica').text('Not Applicable', 40, currentY);
        currentY += 20;
      }

      // -------------------------------------------------------------
      // SECTION 3: PARTICIPATION & ATTENDANCE SUMMARY
      // -------------------------------------------------------------
      if (currentY > 650) { doc.addPage(); currentY = 40; }

      doc.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold').text('3. Attendance & Participant Demographics', 40, currentY);
      currentY += 18;

      const totalRecs = attendanceRecords.length;
      const presentRecs = attendanceRecords.filter(r => r.attendanceStatus === 'PRESENT').length;
      const absentRecs = attendanceRecords.filter(r => r.attendanceStatus === 'ABSENT').length;
      const attPercent = totalRecs > 0 ? Math.round((presentRecs / totalRecs) * 100) : 0;

      // Stats Cards Grid
      const cardWidth = 120;
      const cards = [
        { label: 'Expected', val: activity.expectedParticipants || 0 },
        { label: 'Registered Total', val: totalRecs },
        { label: 'Present', val: presentRecs },
        { label: 'Attendance %', val: `${attPercent}%` }
      ];

      cards.forEach((c, i) => {
        const x = 40 + i * (cardWidth + 10);
        doc.rect(x, currentY, cardWidth, 35).fillAndStroke('#f4f5f7', BORDER_COLOR);
        doc.fillColor(TEXT_MUTED).fontSize(7.5).font('Helvetica-Bold').text(c.label.toUpperCase(), x + 8, currentY + 6);
        doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold').text(String(c.val), x + 8, currentY + 18);
      });
      currentY += 45;

      // Attendance Table
      doc.fillColor(TEXT_DARK).fontSize(9).font('Helvetica-Bold').text('Participant Register Log (Sample Excerpt):', 40, currentY);
      currentY += 14;

      // Table Header
      doc.rect(40, currentY, 515, 18).fill(PRIMARY);
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('Participant Name', 48, currentY + 5);
      doc.text('PRN / ID', 200, currentY + 5);
      doc.text('Department', 310, currentY + 5);
      doc.text('Type', 420, currentY + 5);
      doc.text('Status', 490, currentY + 5);
      currentY += 18;

      if (attendanceRecords.length === 0) {
        doc.rect(40, currentY, 515, 20).fillAndStroke('#ffffff', BORDER_COLOR);
        doc.fillColor(TEXT_MUTED).fontSize(8).font('Helvetica').text('No attendance records logged.', 48, currentY + 6);
        currentY += 25;
      } else {
        const rowsToRender = attendanceRecords.slice(0, 15); // Render top 15 records in official summary
        rowsToRender.forEach((r, idx) => {
          if (currentY > 730) { doc.addPage(); currentY = 40; }
          const bg = idx % 2 === 0 ? '#ffffff' : '#fafbfc';
          doc.rect(40, currentY, 515, 18).fillAndStroke(bg, BORDER_COLOR);
          doc.fillColor(TEXT_DARK).fontSize(7.5).font('Helvetica');
          doc.text(r.participantName || 'N/A', 48, currentY + 5, { width: 140, height: 10 });
          doc.text(r.participantId || 'N/A', 200, currentY + 5);
          doc.text(r.department || 'General', 310, currentY + 5);
          doc.text(r.participantType || 'STUDENT', 420, currentY + 5);
          doc.fillColor(r.attendanceStatus === 'PRESENT' ? '#059669' : '#dc2626').font('Helvetica-Bold').text(r.attendanceStatus, 490, currentY + 5);
          currentY += 18;
        });

        if (attendanceRecords.length > 15) {
          doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica-Oblique').text(`... and ${attendanceRecords.length - 15} additional verified participant records stored in MongoDB master log.`, 40, currentY + 4);
          currentY += 18;
        }
      }

      // -------------------------------------------------------------
      // SECTION 4: ACTIVITY OUTCOMES & REPORT SUMMARY
      // -------------------------------------------------------------
      if (currentY > 600) { doc.addPage(); currentY = 40; }

      doc.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold').text('4. Post-Event Outcomes & Highlights', 40, currentY);
      currentY += 18;

      const highlights = report?.keyHighlights || 'Not Provided';
      const outcomes = report?.outcomes || 'Not Provided';
      const conclusion = report?.conclusion || 'Not Provided';

      doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text('Key Highlights:', 40, currentY);
      doc.font('Helvetica').fillColor(TEXT_MUTED).text(highlights, 130, currentY, { width: 425 });
      currentY += doc.heightOfString(highlights, { width: 425 }) + 10;

      doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text('Learning Outcomes:', 40, currentY);
      doc.font('Helvetica').fillColor(TEXT_MUTED).text(outcomes, 130, currentY, { width: 425 });
      currentY += doc.heightOfString(outcomes, { width: 425 }) + 10;

      doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text('Conclusion & Impact:', 40, currentY);
      doc.font('Helvetica').fillColor(TEXT_MUTED).text(conclusion, 130, currentY, { width: 425 });
      currentY += doc.heightOfString(conclusion, { width: 425 }) + 15;

      // -------------------------------------------------------------
      // SECTION 5: VERIFIED MEDIA DOCUMENTATION
      // -------------------------------------------------------------
      if (currentY > 580) { doc.addPage(); currentY = 40; }

      doc.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold').text('5. Verified Photographs & Media Evidence', 40, currentY);
      currentY += 18;

      if (verifiedMedia.length === 0) {
        doc.fillColor(TEXT_MUTED).fontSize(8.5).font('Helvetica').text('No verified event photographs uploaded.', 40, currentY);
        currentY += 20;
      } else {
        doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text(`Verified Photographic Records (${verifiedMedia.length} item(s)):`, 40, currentY);
        currentY += 14;

        // Render image captions / file notices
        verifiedMedia.slice(0, 4).forEach((m, idx) => {
          doc.rect(40, currentY, 515, 22).fillAndStroke('#f4f5f7', BORDER_COLOR);
          doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold').text(`[PHOTO #${idx + 1}] ${m.caption || 'Event Image'}`, 48, currentY + 6);
          doc.fillColor(TEXT_MUTED).fontSize(7.5).font('Helvetica').text(`URL: ${m.fileUrl} (Verified by HOD)`, 250, currentY + 6);
          currentY += 26;
        });
      }

      // -------------------------------------------------------------
      // SECTION 6: DOCUMENTATION COMPLETENESS & APPROVALS
      // -------------------------------------------------------------
      if (currentY > 620) { doc.addPage(); currentY = 40; }

      doc.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold').text('6. Audit Trail & Verification Signatures', 40, currentY);
      currentY += 18;

      doc.rect(40, currentY, 515, 45).fillAndStroke('#f4f5f7', BORDER_COLOR);
      doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text(`Documentation Completeness Score: ${completenessScore}%`, 50, currentY + 8);
      doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED).text('Score computed automatically from verified MongoDB activity details, attendance registers, photo logs, and verified reports.', 50, currentY + 22);
      currentY += 60;

      // Formal Signature Block
      doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text('OFFICIAL INSTITUTIONAL SIGNATURES', 40, currentY);
      currentY += 35;

      const sigWidth = 150;
      // Signature 1: Coordinator
      doc.moveTo(40, currentY).lineTo(40 + sigWidth, currentY).strokeColor(TEXT_DARK).lineWidth(1).stroke();
      doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text('Prepared By:', 40, currentY + 6);
      doc.font('Helvetica').text(activity.coordinatorId?.name || 'Activity Coordinator', 40, currentY + 18);
      doc.fontSize(7.5).fillColor(TEXT_MUTED).text(`Date: ${genDate}`, 40, currentY + 30);

      // Signature 2: HOD
      doc.moveTo(220, currentY).lineTo(220 + sigWidth, currentY).strokeColor(TEXT_DARK).lineWidth(1).stroke();
      doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text('Verified By:', 220, currentY + 6);
      doc.font('Helvetica').text(activity.hodId?.name || 'Head of Department', 220, currentY + 18);
      doc.fontSize(7.5).fillColor(TEXT_MUTED).text(`Date: ${report?.reviewedAt ? new Date(report.reviewedAt).toLocaleDateString('en-IN') : genDate}`, 220, currentY + 30);

      // Signature 3: Director
      doc.moveTo(400, currentY).lineTo(400 + sigWidth, currentY).strokeColor(TEXT_DARK).lineWidth(1).stroke();
      doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica-Bold').text('Approved By:', 400, currentY + 6);
      doc.font('Helvetica').text('Director, RCPIT', 400, currentY + 18);
      doc.fontSize(7.5).fillColor(TEXT_MUTED).text('R. C. Patel Institute of Technology', 400, currentY + 30);

      // -------------------------------------------------------------
      // FOOTER & PAGE NUMBERING (Page X of Y)
      // -------------------------------------------------------------
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.moveTo(40, 790).lineTo(555, 790).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke();
        doc.fillColor(TEXT_MUTED).fontSize(7.5).font('Helvetica').text(
          `ActivityTracker RCPIT — Official Record | ${reportId}`,
          40, 796
        );
        doc.text(
          `Page ${i + 1} of ${range.count}`,
          500, 796, { align: 'right' }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
