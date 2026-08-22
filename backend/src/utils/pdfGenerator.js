import PDFDocument from 'pdfkit';

export const generateEventPDF = (activity, report, res) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Activity_Report_${activity.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);

  doc.pipe(res);

  // Header Banner
  doc.rect(0, 0, 595, 70).fill('#053c85');
  doc.fillColor('#FFFFFF').fontSize(18).text('R. C. PATEL INSTITUTE OF TECHNOLOGY, SHIRPUR', 40, 18, { align: 'left' });
  doc.fontSize(11).text('ActivityTracker RCPIT — Official Activity Summary Report', 40, 42, { align: 'left' });

  doc.moveDown(3);

  // Title Section
  doc.fillColor('#0a336f').fontSize(16).text(activity.title, { underline: true });
  doc.moveDown(0.5);

  // Key Metadata Table Box
  doc.rect(40, 130, 515, 100).fillAndStroke('#f0f6ff', '#b9d9fe');
  doc.fillColor('#072049').fontSize(10);
  
  doc.text(`Department: ${activity.departmentId?.name || 'Academic Dept'}`, 50, 140);
  doc.text(`Category: ${activity.category}`, 300, 140);
  doc.text(`Date: ${new Date(activity.date).toLocaleDateString()}`, 50, 160);
  doc.text(`Time: ${activity.startTime} - ${activity.endTime}`, 300, 160);
  doc.text(`Venue: ${activity.venueName || 'TBD'}`, 50, 180);
  doc.text(`Coordinator: ${activity.coordinatorId?.name || 'Faculty Member'}`, 300, 180);
  doc.text(`Status: ${activity.status}`, 50, 200);
  doc.text(`Documentation Score: ${activity.documentationScore}%`, 300, 200);

  doc.moveDown(6);

  // Description & Objectives
  doc.fillColor('#0a336f').fontSize(13).text('1. Activity Description & Objectives');
  doc.fillColor('#333333').fontSize(10).text(activity.description || 'No description provided.');
  doc.moveDown(0.5);
  doc.fillColor('#555555').fontSize(10).text(`Objectives: ${activity.objectives || 'N/A'}`);

  doc.moveDown(1.5);

  // Speaker Details
  if (activity.guestSpeaker && activity.guestSpeaker.name) {
    doc.fillColor('#0a336f').fontSize(13).text('2. Resource Person / Guest Speaker');
    doc.fillColor('#333333').fontSize(10).text(`Name: ${activity.guestSpeaker.name}`);
    doc.text(`Designation: ${activity.guestSpeaker.designation || 'N/A'}`);
    doc.text(`Organization: ${activity.guestSpeaker.organization || 'N/A'}`);
    doc.moveDown(1.5);
  }

  // Report Outcome & Highlights
  if (report) {
    doc.fillColor('#0a336f').fontSize(13).text('3. Conducted Event Highlights & Outcome');
    doc.fillColor('#333333').fontSize(10).text(`Actual Participants: ${report.actualParticipantsCount || activity.expectedParticipants}`);
    doc.text(`Key Highlights: ${report.keyHighlights || 'N/A'}`);
    doc.text(`Outcome: ${report.outcome || 'N/A'}`);
    doc.text(`Achievements: ${report.achievements || 'N/A'}`);
    doc.moveDown(1.5);
  }

  // Verification & Signatures Footer
  doc.rect(40, 720, 515, 60).stroke('#cccccc');
  doc.fillColor('#333333').fontSize(9);
  doc.text(`Coordinator Signature`, 60, 735);
  doc.text(`HOD Verification Signature`, 220, 735);
  doc.text(`Director Approval / Stamp`, 400, 735);

  doc.fontSize(8).fillColor('#888888').text(`Report ID: RCPIT-ACT-${activity._id} | Generated on ${new Date().toLocaleString()}`, 40, 790, { align: 'center' });

  doc.end();
};

export const generateDepartmentPDF = (department, activities, res) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Department_Summary_${department.code}.pdf"`);

  doc.pipe(res);

  // Header Banner
  doc.rect(0, 0, 595, 70).fill('#0047a3');
  doc.fillColor('#FFFFFF').fontSize(18).text(`${department.name.toUpperCase()} (${department.code})`, 40, 18);
  doc.fontSize(11).text('Departmental Activity Profile & Performance Summary Report', 40, 42);

  doc.moveDown(3);

  // Summary Metrics
  doc.fillColor('#0a336f').fontSize(14).text('Department Overview', { underline: true });
  doc.moveDown(0.5);
  doc.fillColor('#333333').fontSize(10);
  doc.text(`HOD: ${department.hodId?.name || 'Assigned HOD'}`);
  doc.text(`Total Recorded Activities: ${activities.length}`);
  doc.text(`Department Performance Score: ${department.performanceScore || 85}/100`);

  doc.moveDown(1.5);

  // Activities Table Header
  doc.fillColor('#0a336f').fontSize(12).text('Activity Records Listing');
  doc.moveDown(0.5);

  doc.rect(40, 200, 515, 20).fill('#e0edff');
  doc.fillColor('#0a336f').fontSize(9).text('Date', 50, 205);
  doc.text('Activity Title', 120, 205);
  doc.text('Category', 320, 205);
  doc.text('Status', 440, 205);

  let y = 225;
  activities.slice(0, 15).forEach((act) => {
    doc.fillColor('#333333').fontSize(8);
    doc.text(new Date(act.date).toLocaleDateString(), 50, y);
    doc.text(act.title.substring(0, 35), 120, y);
    doc.text(act.category, 320, y);
    doc.text(act.status, 440, y);
    y += 20;
  });

  doc.fontSize(8).fillColor('#888888').text(`Department Summary | ActivityTracker RCPIT | Page 1`, 40, 790, { align: 'center' });

  doc.end();
};
