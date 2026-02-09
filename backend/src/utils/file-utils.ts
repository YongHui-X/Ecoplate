import { randomBytes } from "crypto";

/**
 * Allowed image MIME types
 */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

/**
 * Allowed image extensions
 */
export const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"] as const;

/**
 * Magic bytes for image format detection
 */
const IMAGE_MAGIC_BYTES: Record<string, number[]> = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  gif: [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF header, WebP follows
};

/**
 * Generate a cryptographically secure random string
 */
export function generateSecureRandom(length: number = 16): string {
  return randomBytes(length).toString("hex");
}

/**
 * Generate a secure filename for uploaded files
 * @param userId - The user ID uploading the file
 * @param originalName - The original filename
 * @param prefix - Optional prefix for the filename (e.g., 'listing', 'profile')
 * @returns A secure filename with timestamp and random suffix
 */
export function generateSecureFilename(
  userId: number,
  originalName: string,
  prefix?: string
): string {
  const ext = getFileExtension(originalName);
  const timestamp = Date.now();
  const random = generateSecureRandom(8);
  const prefixPart = prefix ? `${prefix}-` : "";

  return `${prefixPart}${userId}-${timestamp}-${random}.${ext}`;
}

/**
 * Get the file extension from a filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "bin";
}

/**
 * Validate file extension against allowed list
 */
export function isAllowedImageExtension(filename: string): boolean {
  const ext = getFileExtension(filename);
  return (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Validate MIME type against allowed list
 */
export function isAllowedImageMimeType(mimeType: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Validate image by checking magic bytes
 * @param buffer - The file buffer to validate
 * @returns The detected image type or null if invalid
 */
export function validateImageMagicBytes(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 4) {
    return null;
  }

  // Check JPEG
  if (
    bytes[0] === IMAGE_MAGIC_BYTES.jpeg[0] &&
    bytes[1] === IMAGE_MAGIC_BYTES.jpeg[1] &&
    bytes[2] === IMAGE_MAGIC_BYTES.jpeg[2]
  ) {
    return "jpeg";
  }

  // Check PNG
  if (
    bytes[0] === IMAGE_MAGIC_BYTES.png[0] &&
    bytes[1] === IMAGE_MAGIC_BYTES.png[1] &&
    bytes[2] === IMAGE_MAGIC_BYTES.png[2] &&
    bytes[3] === IMAGE_MAGIC_BYTES.png[3]
  ) {
    return "png";
  }

  // Check GIF
  if (
    bytes[0] === IMAGE_MAGIC_BYTES.gif[0] &&
    bytes[1] === IMAGE_MAGIC_BYTES.gif[1] &&
    bytes[2] === IMAGE_MAGIC_BYTES.gif[2]
  ) {
    return "gif";
  }

  // Check WebP (RIFF....WEBP)
  if (
    bytes[0] === IMAGE_MAGIC_BYTES.webp[0] &&
    bytes[1] === IMAGE_MAGIC_BYTES.webp[1] &&
    bytes[2] === IMAGE_MAGIC_BYTES.webp[2] &&
    bytes[3] === IMAGE_MAGIC_BYTES.webp[3] &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "webp";
  }

  return null;
}

/**
 * Comprehensive file validation for uploads
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedType?: string;
}

export async function validateImageFile(
  file: File,
  maxSizeBytes: number = 5 * 1024 * 1024
): Promise<FileValidationResult> {
  // Check file size
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size must be less than ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
    };
  }

  // Check MIME type
  if (!isAllowedImageMimeType(file.type)) {
    return {
      valid: false,
      error: "Only JPEG, PNG, GIF, and WebP images are allowed",
    };
  }

  // Check extension
  if (!isAllowedImageExtension(file.name)) {
    return {
      valid: false,
      error: "Invalid file extension",
    };
  }

  // Check magic bytes
  const buffer = await file.arrayBuffer();
  const detectedType = validateImageMagicBytes(buffer);

  if (!detectedType) {
    return {
      valid: false,
      error: "File content does not match a valid image format",
    };
  }

  return {
    valid: true,
    detectedType,
  };
}

/**
 * Sanitize filename to prevent directory traversal
 */
export function sanitizeFilename(filename: string): string {
  // Remove any path separators and null bytes
  return filename
    .replace(/[/\\]/g, "")
    .replace(/\0/g, "")
    .replace(/\.\./g, "");
}
