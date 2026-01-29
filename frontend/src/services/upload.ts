/**
 * Image Upload Service
 * Handles image uploads to the backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface UploadImageResponse {
  imageUrl: string;
  message: string;
}

export interface UploadImagesResponse {
  imageUrls: string[];
  message: string;
}

export const uploadService = {
  /**
   * Upload a single image
   * @param file - The image file to upload
   * @returns Promise with the uploaded image URL
   */
  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("image", file);

    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/upload/image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to upload image");
    }

    const data: UploadImageResponse = await response.json();
    return data.imageUrl;
  },

  /**
   * Upload multiple images
   * @param files - Array of image files to upload
   * @returns Promise with array of uploaded image URLs
   */
  async uploadImages(files: File[]): Promise<string[]> {
    if (files.length === 0) {
      throw new Error("No files provided");
    }

    if (files.length > 5) {
      throw new Error("Maximum 5 images allowed");
    }

    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`image${index}`, file);
    });

    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/upload/images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to upload images");
    }

    const data: UploadImagesResponse = await response.json();
    return data.imageUrls;
  },

  /**
   * Get full image URL (add base URL if needed)
   * @param imageUrl - Relative or absolute image URL
   * @returns Full image URL
   */
  getImageUrl(imageUrl: string): string {
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return imageUrl; // Already absolute URL
    }
    return `${API_BASE_URL}/${imageUrl}`;
  },

  /**
   * Parse images from JSON string
   * @param imagesJson - JSON string of image URLs
   * @returns Array of image URLs
   */
  parseImages(imagesJson: string | null): string[] {
    if (!imagesJson) {
      return [];
    }
    try {
      const parsed = JSON.parse(imagesJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  /**
   * Get full URLs for all images in a listing
   * @param imagesJson - JSON string of image URLs
   * @returns Array of full image URLs
   */
  getListingImageUrls(imagesJson: string | null): string[] {
    const images = this.parseImages(imagesJson);
    return images.map((url) => this.getImageUrl(url));
  },
};
