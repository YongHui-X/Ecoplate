import { useState, useRef, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export interface UseCameraReturn {
  /** The captured image as a base64 data URL, or null */
  capturedImage: string | null;
  /** Whether the webcam stream is active (web only) */
  isStreaming: boolean;
  /** Whether the camera is initializing */
  isLoading: boolean;
  /** Error message for display */
  error: string | null;
  /** Whether running on a native platform */
  isNative: boolean;
  /** Ref to attach to the <video> element (web only) */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Start the camera (native: opens camera UI, web: starts stream) */
  startCamera: () => Promise<void>;
  /** Take a snapshot from the webcam stream (web only) */
  capture: () => void;
  /** Clear the captured image and restart camera */
  retake: () => void;
  /** Stop the camera stream and clean up */
  stopCamera: () => void;
  /** Clear the error */
  clearError: () => void;
}

/**
 * Hook for camera access with Capacitor (native) and getUserMedia (web) support.
 *
 * Mobile: Uses @capacitor/camera plugin → returns captured image directly.
 * Web: Opens getUserMedia stream → user clicks capture → preview shown.
 * Both: After capture, show preview with Retake / Confirm options.
 */
export function useCamera(): UseCameraReturn {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isNative = Capacitor.isNativePlatform();

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    setCapturedImage(null);

    if (isNative) {
      // --- Mobile: Use Capacitor Camera plugin ---
      try {
        const { Camera, CameraResultType, CameraSource } = await import(
          "@capacitor/camera"
        );

        const permission = await Camera.checkPermissions();
        if (permission.camera === "denied") {
          await Camera.requestPermissions({ permissions: ["camera"] });
        }

        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
        });

        if (image.base64String) {
          setCapturedImage(
            `data:image/${image.format || "jpeg"};base64,${image.base64String}`
          );
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);
        if (
          message.includes("cancelled") ||
          message.includes("canceled") ||
          message.includes("User cancelled")
        ) {
          // User cancelled — not an error
        } else if (
          message.includes("permission") ||
          message.includes("denied")
        ) {
          setError(
            "Camera permission denied. Please enable camera access in your device settings."
          );
        } else {
          setError("Could not open camera. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      // --- Web: Use getUserMedia ---
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError(
            "Camera is not available in your browser. Try uploading an image instead."
          );
          setIsLoading(false);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setIsStreaming(true);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);
        if (
          err instanceof DOMException &&
          (err.name === "NotAllowedError" ||
            err.name === "PermissionDeniedError")
        ) {
          setError(
            "Camera permission denied. Please allow camera access in your browser settings and try again."
          );
        } else if (
          err instanceof DOMException &&
          (err.name === "NotFoundError" ||
            err.name === "DevicesNotFoundError")
        ) {
          setError(
            "No camera found on this device. Try uploading an image instead."
          );
        } else if (
          err instanceof DOMException &&
          err.name === "NotReadableError"
        ) {
          setError(
            "Camera is in use by another application. Please close it and try again."
          );
        } else {
          setError(`Could not access camera: ${message}`);
        }
      } finally {
        setIsLoading(false);
      }
    }
  }, [isNative]);

  const capture = useCallback(() => {
    if (!videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    stopStream();
    setCapturedImage(dataUrl);
  }, [stopStream]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setError(null);
    if (!isNative) {
      // Restart webcam stream on web
      startCamera();
    }
  }, [isNative, startCamera]);

  const stopCamera = useCallback(() => {
    stopStream();
    setCapturedImage(null);
    setError(null);
  }, [stopStream]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    capturedImage,
    isStreaming,
    isLoading,
    error,
    isNative,
    videoRef,
    startCamera,
    capture,
    retake,
    stopCamera,
    clearError,
  };
}
