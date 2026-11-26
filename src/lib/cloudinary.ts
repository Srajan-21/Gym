export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';

export const isCloudinaryConfigured =
  Boolean(cloudName) &&
  Boolean(uploadPreset) &&
  !cloudName.includes('your-cloud-name');

/**
 * Uploads a local image URI (from Expo ImagePicker) to Cloudinary using an unsigned preset.
 */
export async function uploadProgressPhoto(
  localUri: string,
  logDate: string
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured) {
    throw new Error(
      'Cloudinary is not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env'
    );
  }

  const formData = new FormData();
  const filename = `gym_${logDate}_${Date.now()}.jpg`;

  formData.append('file', {
    uri: localUri,
    type: 'image/jpeg',
    name: filename,
  } as unknown as Blob);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'gym_progress_photos');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

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

/**
 * Returns an optimized Cloudinary delivery URL with auto format/quality and width cap.
 */
export function getOptimizedPhotoUrl(url: string, width = 800): string {
  if (!url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
}
