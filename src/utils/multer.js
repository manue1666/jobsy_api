import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';

// Crear directorio si no existe
fs.ensureDirSync('tmp/uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'tmp/uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `upload-${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes'), false);
  }
};

export default multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter
});