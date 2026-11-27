export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'kcj86z0m';
const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'Progress';

export const isCloudinaryConfigured =
  Boolean(cloudName) &&
  Boolean(uploadPreset) &&
  !cloudName.includes('your-cloud-name');

/**
 * Uploads an image to Cloudinary using an unsigned preset.
 * Prefers a base64 data URI (works reliably across RN 0.88 / Expo SDK 58 FormData),
 * and falls back to XMLHttpRequest for file URIs.
 */
export async function uploadProgressPhoto(
  localUri: string,
  logDate: string,
  base64?: string | null
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured) {
    throw new Error(
      'Cloudinary is not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env'
    );
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  if (base64) {
    const body = new URLSearchParams();
    body.append('file', `data:image/jpeg;base64,${base64}`);
    body.append('upload_preset', uploadPreset);
    body.append('folder', 'gym_progress_photos');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudinary upload failed: ${errorText}`);
    }

    const data = (await response.json()) as CloudinaryUploadResult;
    return {
      secure_url: data.secure_url,
      public_id: data.public_id,
    };
  }

  // Fallback via XMLHttpRequest for file:// URIs when base64 isn't available
  const formData = new FormData();
  const filename = `gym_${logDate}_${Date.now()}.jpg`;
  formData.append('file', {
    uri: localUri,
    type: 'image/jpeg',
    name: filename,
  } as unknown as Blob);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'gym_progress_photos');

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText) as CloudinaryUploadResult;
        resolve({ secure_url: data.secure_url, public_id: data.public_id });
      } else {
        reject(new Error(`Cloudinary upload failed: ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error uploading photo to Cloudinary'));
    xhr.send(formData);
  });
}

/**
 * Returns an optimized Cloudinary delivery URL with auto format/quality and width cap.
 */
export function getOptimizedPhotoUrl(url: string, width = 800): string {
  if (!url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
}
