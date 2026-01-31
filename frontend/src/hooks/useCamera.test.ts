import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCamera } from "./useCamera";

// Mock Capacitor
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

describe("useCamera", () => {
  let mockStream: MediaStream;
  let mockTrack: MediaStreamTrack;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTrack = {
      stop: vi.fn(),
      kind: "video",
      id: "mock-track",
    } as unknown as MediaStreamTrack;

    mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
    } as unknown as MediaStream;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.capturedImage).toBeNull();
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isNative).toBe(false);
  });

  describe("Web Platform", () => {
    beforeEach(() => {
      Object.defineProperty(global.navigator, "mediaDevices", {
        value: {
          getUserMedia: vi.fn(),
        },
        writable: true,
        configurable: true,
      });
    });

    it("should start web camera stream successfully", async () => {
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
        mockStream
      );

      const { result } = renderHook(() => useCamera());

      // Mock the video element to have play() method
      const mockVideo = document.createElement("video");
      vi.spyOn(mockVideo, "play").mockResolvedValue(undefined);
      Object.defineProperty(result.current.videoRef, "current", {
        value: mockVideo,
        writable: true,
      });

      await act(async () => {
        await result.current.startCamera();
      });

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      expect(result.current.isStreaming).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should handle permission denied error", async () => {
      const permissionError = new DOMException(
        "Permission denied",
        "NotAllowedError"
      );
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
        permissionError
      );

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.error).toContain("Camera permission denied");
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle camera not found error", async () => {
      const notFoundError = new DOMException(
        "No camera",
        "NotFoundError"
      );
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
        notFoundError
      );

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.error).toContain("No camera found");
      expect(result.current.isStreaming).toBe(false);
    });

    it("should handle camera in use error", async () => {
      const inUseError = new DOMException(
        "Camera in use",
        "NotReadableError"
      );
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
        inUseError
      );

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.error).toContain("Camera is in use");
    });

    it("should handle browser without camera support", async () => {
      Object.defineProperty(global.navigator, "mediaDevices", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.error).toContain("Camera is not available");
      expect(result.current.isLoading).toBe(false);
    });

    it("should capture image from video stream", async () => {
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
        mockStream
      );

      // Mock canvas getContext since jsdom doesn't support it
      const mockCtx = { drawImage: vi.fn() };
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === "canvas") {
          (el as HTMLCanvasElement).getContext = vi.fn(() => mockCtx) as unknown as HTMLCanvasElement['getContext'];
          (el as HTMLCanvasElement).toDataURL = vi.fn(() => "data:image/jpeg;base64,mockdata");
        }
        return el;
      });

      const { result } = renderHook(() => useCamera());

      // Set up video element mock
      const mockVideo = document.createElement("video");
      vi.spyOn(mockVideo, "play").mockResolvedValue(undefined);
      Object.defineProperty(mockVideo, "videoWidth", { value: 1920 });
      Object.defineProperty(mockVideo, "videoHeight", { value: 1080 });
      Object.defineProperty(result.current.videoRef, "current", {
        value: mockVideo,
        writable: true,
      });

      // Start camera first
      await act(async () => {
        await result.current.startCamera();
      });

      // Capture
      act(() => {
        result.current.capture();
      });

      // After capture, stream should be stopped and image should be set
      expect(mockTrack.stop).toHaveBeenCalled();
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.capturedImage).not.toBeNull();
    });

    it("should not capture without active stream", () => {
      const { result } = renderHook(() => useCamera());

      act(() => {
        result.current.capture();
      });

      expect(result.current.capturedImage).toBeNull();
    });

    it("should stop camera and clean up", async () => {
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
        mockStream
      );

      const { result } = renderHook(() => useCamera());

      const mockVideo = document.createElement("video");
      vi.spyOn(mockVideo, "play").mockResolvedValue(undefined);
      Object.defineProperty(result.current.videoRef, "current", {
        value: mockVideo,
        writable: true,
      });

      await act(async () => {
        await result.current.startCamera();
      });

      act(() => {
        result.current.stopCamera();
      });

      expect(mockTrack.stop).toHaveBeenCalled();
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.capturedImage).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("should clear error", async () => {
      const permissionError = new DOMException(
        "Permission denied",
        "NotAllowedError"
      );
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
        permissionError
      );

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it("should clean up stream on unmount", async () => {
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
        mockStream
      );

      const { result, unmount } = renderHook(() => useCamera());

      const mockVideo = document.createElement("video");
      vi.spyOn(mockVideo, "play").mockResolvedValue(undefined);
      Object.defineProperty(result.current.videoRef, "current", {
        value: mockVideo,
        writable: true,
      });

      await act(async () => {
        await result.current.startCamera();
      });

      unmount();

      expect(mockTrack.stop).toHaveBeenCalled();
    });
  });
});
