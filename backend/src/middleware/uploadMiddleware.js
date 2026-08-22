import multer from 'multer';
import path from 'path';

// Memory storage so files are held in buffer and handled via storageService
const memoryStorage = multer.memoryStorage();

// File Filter Helpers
const imageFileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid image type. Allowed: ${allowedExtensions.join(', ')}`), false);
  }
};

const videoFileFilter = (req, file, cb) => {
  const allowedExtensions = ['.mp4', '.webm', '.mov'];
  const allowedMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime'];

  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid video type. Allowed: ${allowedExtensions.join(', ')}`), false);
  }
};

const documentFileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'];
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png'
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid document type. Allowed: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG`), false);
  }
};

export const uploadImages = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per image
  fileFilter: imageFileFilter
});

export const uploadVideo = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB per video
  fileFilter: videoFileFilter
});

export const uploadIdentityCard = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit for identity card photo
  fileFilter: imageFileFilter
});

export const uploadDocument = multer({
  storage: memoryStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB per document
  fileFilter: documentFileFilter
});

export const upload = uploadDocument;
