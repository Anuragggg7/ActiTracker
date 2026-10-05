import Media from '../models/Media.js';
import Activity from '../models/Activity.js';
import Notification from '../models/Notification.js';
import storageService from '../utils/storageService.js';
import { calculateCompletenessScore } from '../utils/completenessCalculator.js';
import { logAudit } from '../utils/auditLogger.js';

// Get all media for an activity
export const getActivityMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const media = await Media.find({ activityId: id })
      .populate('uploadedBy', 'name email designation profilePhoto')
      .populate('verifiedBy', 'name email designation')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: media.length, media });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload Images (Multiple)
export const uploadImages = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await Activity.findById(id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    const user = req.user;
    if (user.role === 'DIRECTOR') {
      return res.status(403).json({ success: false, message: 'Director has read-only access to media' });
    }

    const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
    const actDeptId = (activity.departmentId?._id || activity.departmentId)?.toString();

    if (
      user.role === 'FACULTY' &&
      activity.coordinatorId.toString() !== user._id.toString() &&
      userDeptId !== actDeptId
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized to upload media for this activity' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files provided' });
    }

    const createdMedia = [];

    for (const file of req.files) {
      const { fileUrl, fileName } = await storageService.upload(file, 'images');

      const mediaItem = await Media.create({
        activityId: id,
        uploadedBy: user._id,
        departmentId: activity.departmentId,
        mediaType: 'IMAGE',
        fileName,
        fileUrl,
        mimeType: file.mimetype,
        fileSize: file.size,
        caption: req.body.caption || file.originalname,
        description: req.body.description || '',
        verificationStatus: user.role === 'HOD' || user.role === 'ADMIN' ? 'VERIFIED' : 'PENDING'
      });

      createdMedia.push(mediaItem);
    }

    if (user.role === 'FACULTY') {
      await Notification.createIdempotent({
        recipientId: activity.hodId || activity.departmentId,
        recipientRole: 'HOD',
        title: `Media Uploaded for Review: "${activity.title}"`,
        message: `${user.name} uploaded ${createdMedia.length} new photos for activity "${activity.title}".`,
        type: 'MEDIA_UPLOADED',
        link: `/activities/${id}`
      });
    }

    await calculateCompletenessScore(id);
    await logAudit({ req, user, action: 'UPLOAD_MEDIA_IMAGES', entity: 'Media', entityId: id, details: `Uploaded ${createdMedia.length} images` });

    res.status(201).json({
      success: true,
      message: `Successfully uploaded ${createdMedia.length} image(s)`,
      media: createdMedia
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload Video
export const uploadVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await Activity.findById(id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });

    const user = req.user;
    if (user.role === 'DIRECTOR') {
      return res.status(403).json({ success: false, message: 'Director has read-only access' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file provided' });
    }

    const { fileUrl, fileName } = await storageService.upload(req.file, 'videos');

    const mediaItem = await Media.create({
      activityId: id,
      uploadedBy: user._id,
      departmentId: activity.departmentId,
      mediaType: 'VIDEO',
      fileName,
      fileUrl,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      caption: req.body.caption || req.file.originalname,
      description: req.body.description || '',
      verificationStatus: user.role === 'HOD' || user.role === 'ADMIN' ? 'VERIFIED' : 'PENDING'
    });

    await calculateCompletenessScore(id);

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      media: mediaItem
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify or Reject Media (HOD / Admin)
export const verifyMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { status, rejectionReason } = req.body;

    const media = await Media.findById(mediaId).populate('activityId');
    if (!media) return res.status(404).json({ success: false, message: 'Media record not found' });

    const user = req.user;
    if (!['HOD', 'ADMIN'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Only HOD or Admin can verify media' });
    }

    const userDeptId = (user.departmentId?._id || user.departmentId)?.toString();
    const actDeptId = (media.departmentId?._id || media.departmentId)?.toString();
    if (user.role === 'HOD' && userDeptId !== actDeptId) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Cannot verify media of another department.' });
    }

    if (status === 'REJECTED' && !rejectionReason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    media.verificationStatus = status;
    media.verifiedBy = user._id;
    media.verifiedAt = new Date();
    if (status === 'REJECTED') {
      media.rejectionReason = rejectionReason;
    }
    await media.save();

    await Notification.createIdempotent({
      recipientId: media.uploadedBy,
      title: `Media ${status}: "${media.caption || 'Event Media'}"`,
      message: status === 'VERIFIED'
        ? `Your uploaded media for "${media.activityId?.title}" has been verified by HOD.`
        : `Your media was rejected. Reason: ${rejectionReason}`,
      type: status === 'VERIFIED' ? 'MEDIA_VERIFIED' : 'MEDIA_REJECTED',
      link: `/activities/${media.activityId?._id}`
    });

    await calculateCompletenessScore(media.activityId._id);

    res.json({
      success: true,
      message: `Media successfully ${status.toLowerCase()}`,
      media
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Media
export const deleteMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const media = await Media.findById(mediaId);
    if (!media) return res.status(404).json({ success: false, message: 'Media not found' });

    const user = req.user;
    const isUploader = media.uploadedBy.toString() === user._id.toString();
    const isAdminOrHod = ['ADMIN', 'HOD'].includes(user.role);

    if (!isUploader && !isAdminOrHod) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this media' });
    }

    await storageService.delete(media.fileUrl);
    await Media.findByIdAndDelete(mediaId);
    await calculateCompletenessScore(media.activityId);

    res.json({ success: true, message: 'Media file removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all media across all activities (for Media Center)
export const getAllMedia = async (req, res) => {
  try {
    const media = await Media.find()
      .populate('uploadedBy', 'name email designation profilePhoto')
      .populate('verifiedBy', 'name email designation')
      .populate('activityId', 'title code departmentId')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: media.length, media });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
