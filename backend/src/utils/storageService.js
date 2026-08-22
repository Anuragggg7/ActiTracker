import fs from 'fs';
import path from 'path';

/**
 * Storage Abstraction Layer
 * Handles file storage locally for development, structured so Cloudinary/AWS S3
 * can be plugged in without changing controller logic.
 */

const UPLOADS_BASE_DIR = path.join(process.cwd(), 'public', 'uploads');

// Ensure base upload directory exists
if (!fs.existsSync(UPLOADS_BASE_DIR)) {
  fs.mkdirSync(UPLOADS_BASE_DIR, { recursive: true });
}

export const storageService = {
  /**
   * Save an uploaded file to storage
   * @param {Object} file - Multer file object
   * @param {String} subfolder - e.g. 'images', 'videos', 'documents'
   * @returns {Promise<{ fileUrl: String, fileName: String }>}
   */
  async upload(file, subfolder = 'general') {
    const targetDir = path.join(UPLOADS_BASE_DIR, subfolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${uniqueSuffix}-${sanitizedOriginalName}`;
    const destinationPath = path.join(targetDir, fileName);

    if (file.buffer) {
      await fs.promises.writeFile(destinationPath, file.buffer);
    } else if (file.path && file.path !== destinationPath) {
      await fs.promises.copyFile(file.path, destinationPath);
      // Clean up temp file if needed
      fs.unlink(file.path, () => {});
    }

    const fileUrl = `/uploads/${subfolder}/${fileName}`;
    return { fileUrl, fileName };
  },

  /**
   * Delete a file from storage
   * @param {String} fileUrl - e.g. '/uploads/images/123-photo.jpg'
   * @returns {Promise<Boolean>}
   */
  async delete(fileUrl) {
    if (!fileUrl || !fileUrl.startsWith('/uploads/')) return false;

    try {
      const relativePath = fileUrl.replace('/uploads/', '');
      const fullPath = path.join(UPLOADS_BASE_DIR, relativePath);

      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
    } catch (err) {
      console.error('Storage delete error:', err);
    }
    return false;
  },

  /**
   * Resolve full public URL for a file
   * @param {String} relativeUrl
   * @returns {String}
   */
  getUrl(relativeUrl) {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl;
    }
    return relativeUrl;
  }
};

export default storageService;
