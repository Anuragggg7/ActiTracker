import Activity from '../models/Activity.js';
import Document from '../models/Document.js';
import { generateAndStoreOfficialPDF } from '../services/reportService.js';

// Stream or Download PDF
export const streamOfficialPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await Activity.findById(id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    // Authorization Check
    const user = req.user;
    const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
    const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();

    if (user.role === 'HOD' && userDeptId !== actDeptId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to another department PDF' });
    }

    if (user.role === 'FACULTY' && activity.coordinatorId.toString() !== user._id.toString() && userDeptId !== actDeptId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to activity PDF' });
    }

    const { pdfBuffer, fileName } = await generateAndStoreOfficialPDF({
      activityId: id,
      user,
      req
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.status(200).send(pdfBuffer);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Generate New PDF Version
export const generateNewPdfVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await Activity.findById(id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    const user = req.user;
    const result = await generateAndStoreOfficialPDF({
      activityId: id,
      user,
      req
    });

    res.status(201).json({
      success: true,
      message: `Official PDF v${result.version} generated successfully`,
      docRecord: result.docRecord,
      fileUrl: result.fileUrl
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get List of Generated PDF Versions
export const getPdfVersions = async (req, res) => {
  try {
    const { id } = req.params;
    const versions = await Document.find({
      activityId: id,
      documentType: 'GENERATED_ACTIVITY_REPORT'
    })
      .populate('uploadedBy', 'name role designation')
      .sort({ version: -1 });

    res.json({ success: true, count: versions.length, versions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
