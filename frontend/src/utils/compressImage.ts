import Compressor from "compressorjs";

const COMPRESSION_TIMEOUT = 5000; // 5 seconds max

/**
 * Convert a base64 data URL to a File without using fetch() (which fails on some mobile webviews).
 */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new File([array], filename, { type: mime });
}

/**
 * Compress an image file to JPEG with reduced quality and max dimensions.
 * Falls back to the original file if compression fails or times out.
 */
export async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn("[Compression] Timed out, using original");
      resolve(file);
    }, COMPRESSION_TIMEOUT);

    try {
      new Compressor(file, {
        quality: 0.7,
        maxWidth: 1920,
        maxHeight: 1920,
        mimeType: "image/jpeg",
        success: (result) => {
          clearTimeout(timeout);
          const compressedFile = new File(
            [result],
            file.name.replace(/\.\w+$/, ".jpg"),
            { type: "image/jpeg" }
          );

          const originalSize = (file.size / 1024 / 1024).toFixed(2);
          const compressedSize = (compressedFile.size / 1024 / 1024).toFixed(2);
          console.log(`[Compression] ${originalSize}MB → ${compressedSize}MB`);

          resolve(compressedFile);
        },
        error: (err) => {
          clearTimeout(timeout);
          console.error("[Compression] Failed:", err);
          resolve(file);
        },
      });
    } catch (err) {
      clearTimeout(timeout);
      console.error("[Compression] Constructor failed:", err);
      resolve(file);
    }
  });
}

/**
 * Compress a base64 data URL image by converting to File, compressing, and converting back.
 * Falls back to the original base64 if compression fails.
 */
export async function compressBase64(base64: string): Promise<string> {
  try {
    const file = dataUrlToFile(base64, "camera-photo.jpg");

    const compressedFile = await compressImage(file);

    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(compressedFile);
    });
  } catch (err) {
    console.error("[compressBase64] Failed, using original:", err);
    return base64;
  }
}
