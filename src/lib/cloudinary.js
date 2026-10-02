/**
 * Utility for uploading media to Cloudinary using Unsigned Uploads.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

/**
 * Converts a base64 data URL to a Blob.
 * @param {string} dataUrl - Base64 data URL (e.g. from canvas.toDataURL())
 * @returns {Blob}
 */
export function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const binary = atob(data)
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i)
  }
  return new Blob([array], { type: mime })
}

/**
 * Uploads a file or Blob to Cloudinary.
 *
 * @param {File|Blob} file        - The file to upload.
 * @param {'image'|'video'|'raw'|'auto'} resourceType - Cloudinary resource type.
 *   Use 'video' for audio files (mp3, wav) — Cloudinary streams them more efficiently.
 * @returns {Promise<string>}     - The secure_url of the uploaded asset.
 */
export async function uploadToCloudinary(file, resourceType = 'auto') {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your .env file.')
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)

  let response
  try {
    response = await fetch(endpoint, { method: 'POST', body: formData })
  } catch {
    throw new Error('Network error — could not reach Cloudinary. Check your internet connection.')
  }

  if (!response.ok) {
    let message = `Upload failed (HTTP ${response.status})`
    try {
      const body = await response.json()
      if (body?.error?.message) message = body.error.message
    } catch {
      // ignore JSON parse failure
    }
    throw new Error(message)
  }

  const data = await response.json()
  if (!data.secure_url) {
    throw new Error('Upload completed but Cloudinary returned no URL.')
  }

  return data.secure_url
}
