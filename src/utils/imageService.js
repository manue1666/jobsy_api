
import sharp from 'sharp';
import fs from 'fs-extra';
import cloudinary from './cloudinary.js';

export const uploadImage = async (filePath, folder = 'marketplace') => {
  try {
    // 1. Comprimir imagen con Sharp
    const compressedPath = `${filePath}-compressed`;
    
    await sharp(filePath)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(compressedPath);

    // 2. Subir a Cloudinary
    const result = await cloudinary.uploader.upload(compressedPath, {
      folder,
      transformation: [{ quality: 'auto' }]
    });

    // 3. Limpiar archivos temporales
    await Promise.all([
      fs.unlink(filePath),
      fs.unlink(compressedPath)
    ]);

    return result.secure_url;

  } catch (error) {
    // Limpieza en caso de error
    if (await fs.pathExists(filePath)) await fs.unlink(filePath);
    throw error;
  }
};

export const deleteImage = async (imageUrl) => {
  if (!imageUrl) return;
  
  const publicId = imageUrl.split('/').slice(-2).join('/').split('.')[0];
  await cloudinary.uploader.destroy(publicId);
};

export const uploadMultipleImages = async (filePaths, folder = 'marketplace/services') => {
  try {
    const uploadPromises = filePaths.map(async (filePath) => {
      // 1. Comprimir cada imagen
      const compressedPath = `${filePath}-compressed`;
      await sharp(filePath)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(compressedPath);

      // 2. Subir a Cloudinary
      const result = await cloudinary.uploader.upload(compressedPath, {
        folder,
        transformation: [{ quality: 'auto' }]
      });

      // 3. Limpiar archivos temporales
      await Promise.all([
        fs.unlink(filePath),
        fs.unlink(compressedPath)
      ]);

      return result.secure_url;
    });

    return await Promise.all(uploadPromises);

  } catch (error) {
    // Limpieza en caso de error
    await Promise.all(filePaths.map(filePath => 
      fs.pathExists(filePath) ? fs.unlink(filePath) : Promise.resolve()
    ));
    throw error;
  }
};