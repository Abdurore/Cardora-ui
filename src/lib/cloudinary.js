/**
 * Utility for uploading media to Cloudinary using Unsigned Uploads.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Uploads a file to Cloudinary.
 * @param {File|Blob} file - The file to upload.
 * @param {String} resourceType - 'image', 'video', or 'auto'.
 * @returns {Promise<String>} - The secure URL of the uploaded asset.
 */
export async function uploadToCloudinary(file, resourceType = 'auto') {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary configuration missing. Check your .env file.');
  }

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  console.log('[Cloudinary] Starting upload to:', url);
  const formData = new FormData();
  
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  console.log('[Cloudinary] FormData ready:', { 
    file: file.name, 
    type: file.type, 
    preset: UPLOAD_PRESET 
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Upload failed');
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    throw error;
  }
}
