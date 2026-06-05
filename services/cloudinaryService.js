import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a base64 image to Cloudinary
 * @param {string} base64Image - base64 data URI
 * @param {string} publicId - unique identifier
 * @param {string} folder - 'products' | 'kits'
 * @returns {Promise<string>} Cloudinary URL
 */
export async function uploadImage(base64Image, publicId, folder = 'products') {
  if (!base64Image || !base64Image.startsWith('data:')) {
    // Already a URL, return as-is
    return base64Image;
  }
  const result = await cloudinary.uploader.upload(base64Image, {
    public_id: publicId,
    folder: `a5x/${folder}`,
    overwrite: true,
    resource_type: 'image',
    transformation: [
      { width: 1000, height: 1000, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' }
    ]
  });
  return result.secure_url;
}

/**
 * Upload multiple base64 images to Cloudinary
 * @param {string[]} images - array of base64 or URLs
 * @param {string} prefix - public_id prefix
 * @param {string} folder - folder name
 * @returns {Promise<string[]>} array of Cloudinary URLs
 */
export async function uploadImages(images, prefix, folder = 'products') {
  if (!images || images.length === 0) return [];
  const results = await Promise.all(
    images.map((img, i) => uploadImage(img, `${prefix}-img${i}`, folder))
  );
  return results.filter(Boolean);
}

export default cloudinary;
