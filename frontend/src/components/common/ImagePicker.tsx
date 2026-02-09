import { useState, useRef } from "react";
import { Camera, X, Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "../ui/button";
import { uploadService } from "../../services/upload";
import { Capacitor } from "@capacitor/core";

interface ImagePickerProps {
  maxImages?: number;
  onImagesChange: (imageUrls: string[]) => void;
  initialImages?: string[];
}

/**
 * ImagePicker Component
 * Allows users to select images from file system or take photos with camera
 * Supports both web and mobile (Capacitor) platforms
 */
export function ImagePicker({
  maxImages = 5,
  onImagesChange,
  initialImages = [],
}: ImagePickerProps) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check max images
    const remainingSlots = maxImages - images.length;
    if (files.length > remainingSlots) {
      setError(`You can only add ${remainingSlots} more image(s)`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload files
      const fileArray = Array.from(files);
      const imageUrls = await uploadService.uploadImages(fileArray);

      // Update state
      const newImages = [...images, ...imageUrls];
      setImages(newImages);
      onImagesChange(newImages);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload images");
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCameraCapture = async () => {
    // Check if running on mobile platform
    if (!Capacitor.isNativePlatform()) {
      setError("Camera is only available on mobile devices");
      return;
    }

    // Check max images
    if (images.length >= maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Dynamic import to avoid errors on web
      const { Camera: CapCamera, CameraResultType } = await import(
        "@capacitor/camera"
      );

      const photo = await CapCamera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
      });

      if (!photo.dataUrl) {
        throw new Error("No photo data received");
      }

      // Convert data URL to blob
      const response = await fetch(photo.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `photo_${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      // Upload image
      const imageUrl = await uploadService.uploadImage(file);

      // Update state
      const newImages = [...images, imageUrl];
      setImages(newImages);
      onImagesChange(newImages);
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.message !== "User cancelled photos app") {
        setError(err.message || "Failed to capture photo");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onImagesChange(newImages);
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-4">
      {/* Upload buttons */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={!canAddMore || uploading}
        />

        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canAddMore || uploading}
          className="flex-1"
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? "Uploading..." : "Choose Images"}
        </Button>

        {Capacitor.isNativePlatform() && (
          <Button
            type="button"
            variant="outline"
            onClick={handleCameraCapture}
            disabled={!canAddMore || uploading}
            className="flex-1"
          >
            <Camera className="w-4 h-4 mr-2" />
            Take Photo
          </Button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      {/* Image count */}
      <div className="text-sm text-gray-500">
        {images.length} / {maxImages} images
      </div>

      {/* Image preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {images.map((imageUrl, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
            >
              <img
                src={uploadService.getImageUrl(imageUrl)}
                alt={`Product ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {images.length === 0 && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">
            No images added yet. Choose from gallery or take a photo.
          </p>
        </div>
      )}
    </div>
  );
}
