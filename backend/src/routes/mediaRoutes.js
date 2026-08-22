import express from 'express';
import {
  getActivityMedia,
  getAllMedia,
  uploadImages,
  uploadVideo,
  verifyMedia,
  deleteMedia
} from '../controllers/mediaController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { uploadImages as multerImages, uploadVideo as multerVideo } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/media', getAllMedia);
router.get('/', getAllMedia);
router.post('/media/upload', multerImages.array('images', 10), uploadImages);
router.post('/upload', multerImages.array('images', 10), uploadImages);
router.get('/activities/:id/media', getActivityMedia);
router.post('/activities/:id/media/images', multerImages.array('images', 10), uploadImages);
router.post('/activities/:id/media/videos', multerVideo.single('video'), uploadVideo);
router.put('/media/:mediaId/verify', authorize('HOD', 'ADMIN'), verifyMedia);
router.delete('/media/:mediaId', deleteMedia);

export default router;
