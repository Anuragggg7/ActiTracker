import express from 'express';
import { login, registerFaculty, refreshToken, logout, getMe, resetTestDatabase, changePassword } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadIdentityCard } from '../middleware/uploadMiddleware.js';

const router = express.Router();

const facultyRegisterUpload = (req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return uploadIdentityCard.any()(req, res, next);
  }
  next();
};

router.post('/test-reset', resetTestDatabase);
router.post('/login', login);
router.post('/faculty/register', facultyRegisterUpload, registerFaculty);
router.post('/register/faculty', facultyRegisterUpload, registerFaculty);
router.post('/register-faculty', facultyRegisterUpload, registerFaculty);
router.post('/refresh', protect, refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

export default router;
