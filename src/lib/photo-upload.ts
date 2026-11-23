// Client-side photo compression tuned for the Supabase free tier (1 GB storage):
// photos are resized and re-encoded as WebP before upload.
export const PHOTO_MIME = "image/webp";
export const PHOTO_EXT = "webp";

export async function compressPhoto(file: File): Promise<Blob> {
  const { default: imageCompression } = await import("browser-image-compression");
  return imageCompression(file, {
    maxWidthOrHeight: 1920,
    maxSizeMB: 0.6,
    fileType: PHOTO_MIME,
    initialQuality: 0.8,
    useWebWorker: true,
  });
}
