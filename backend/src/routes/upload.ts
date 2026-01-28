import { Router, json, error } from "../utils/router";
import { getUser } from "../middleware/auth";
import { uploadProductImage, uploadProductImages } from "../services/image-upload";

/**
 * Image Upload Routes
 * Handles file uploads for marketplace listings
 */
export function registerUploadRoutes(router: Router) {
  /**
   * Upload single image
   * POST /api/v1/upload/image
   */
  router.post("/api/v1/upload/image", async (req) => {
    try {
      // Verify user is authenticated
      const user = getUser(req);
      if (!user) {
        return error("Unauthorized", 401);
      }

      // Parse multipart form data
      const formData = await req.formData();
      const file = formData.get("image") as File;

      if (!file) {
        return error("No image file provided", 400);
      }

      // Upload image
      const imageUrl = await uploadProductImage(file);

      return json({
        imageUrl,
        message: "Image uploaded successfully",
      });
    } catch (e: any) {
      console.error("Image upload error:", e);
      return error(e.message || "Failed to upload image", 500);
    }
  });

  /**
   * Upload multiple images
   * POST /api/v1/upload/images
   */
  router.post("/api/v1/upload/images", async (req) => {
    try {
      // Verify user is authenticated
      const user = getUser(req);
      if (!user) {
        return error("Unauthorized", 401);
      }

      // Parse multipart form data
      const formData = await req.formData();
      const files: File[] = [];

      // Get all files from form data
      for (const [key, value] of formData.entries()) {
        if (key.startsWith("image") && value instanceof File) {
          files.push(value);
        }
      }

      if (files.length === 0) {
        return error("No image files provided", 400);
      }

      // Limit to 5 images
      if (files.length > 5) {
        return error("Maximum 5 images allowed", 400);
      }

      // Upload all images
      const imageUrls = await uploadProductImages(files);

      return json({
        imageUrls,
        message: `${imageUrls.length} images uploaded successfully`,
      });
    } catch (e: any) {
      console.error("Images upload error:", e);
      return error(e.message || "Failed to upload images", 500);
    }
  });
}
