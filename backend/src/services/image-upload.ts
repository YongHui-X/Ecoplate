import { mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Image Upload Service
 * Handles product image uploads for marketplace listings
 *
 * Development: Stores images locally in public/uploads/marketplace/
 * Production: Can be extended to upload to cloud storage (S3, R2, etc.)
 */

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "marketplace");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/**
 * Initialize upload directory
 */
export async function initializeUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    console.log("✓ Upload directory initialized:", UPLOAD_DIR);
  } catch (error) {
    console.error("Failed to create upload directory:", error);
    throw error;
  }
}

/**
 * Validate image file
 */
export function validateImage(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

/**
 * Generate unique filename
 */
export function generateFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const ext = originalName.split(".").pop() || "jpg";
  return `${timestamp}-${random}.${ext}`;
}

/**
 * Save image file locally
 * @returns URL path to the saved image
 */
export async function saveImageLocally(file: File): Promise<string> {
  const filename = generateFilename(file.name);
  const filepath = join(UPLOAD_DIR, filename);

  // Write file using Bun's file API
  await Bun.write(filepath, file);

  // Return URL path (relative to public folder)
  return `uploads/marketplace/${filename}`;
}

/**
 * Upload image to cloud storage (S3, R2, etc.)
 * TODO: Implement when moving to production
 */
export async function uploadToCloud(file: File): Promise<string> {
  // Example implementation for AWS S3:
  // const s3Client = new S3Client({ region: "us-east-1" });
  // const filename = generateFilename(file.name);
  // const buffer = await file.arrayBuffer();
  //
  // await s3Client.send(new PutObjectCommand({
  //   Bucket: process.env.S3_BUCKET,
  //   Key: `marketplace/${filename}`,
  //   Body: Buffer.from(buffer),
  //   ContentType: file.type,
  // }));
  //
  // return `https://${process.env.CDN_URL}/marketplace/${filename}`;

  throw new Error("Cloud upload not implemented yet");
}

/**
 * Main upload function - handles both dev and production
 */
export async function uploadProductImage(file: File): Promise<string> {
  // Validate image
  const validation = validateImage(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Use environment to determine upload strategy
  if (process.env.NODE_ENV === "production" && process.env.USE_CLOUD_STORAGE === "true") {
    return await uploadToCloud(file);
  } else {
    return await saveImageLocally(file);
  }
}

/**
 * Upload multiple images
 */
export async function uploadProductImages(files: File[]): Promise<string[]> {
  const uploadPromises = files.map((file) => uploadProductImage(file));
  return await Promise.all(uploadPromises);
}

/**
 * Delete image file (for cleanup)
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    // Only delete local files, not cloud URLs
    if (!imageUrl.startsWith("http")) {
      const filepath = join(process.cwd(), "public", imageUrl);
      await Bun.write(filepath, ""); // Bun doesn't have unlink, so we'll use fs
      const fs = await import("node:fs/promises");
      await fs.unlink(filepath);
    }
  } catch (error) {
    console.error("Failed to delete image:", imageUrl, error);
    // Don't throw - missing files are okay
  }
}

/**
 * Delete multiple images
 */
export async function deleteImages(imageUrls: string[]): Promise<void> {
  await Promise.all(imageUrls.map((url) => deleteImage(url)));
}
