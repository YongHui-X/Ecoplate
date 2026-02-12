import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store the mock constructor for use in tests
let mockCompressorCallback: ((file: File, options: {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  mimeType: string;
  success?: (result: Blob) => void;
  error?: (err: Error) => void;
}) => void) | null = null;

// Mock compressorjs with a class constructor
vi.mock("compressorjs", () => {
  return {
    default: class MockCompressor {
      constructor(file: File, options: {
        quality: number;
        maxWidth: number;
        maxHeight: number;
        mimeType: string;
        success?: (result: Blob) => void;
        error?: (err: Error) => void;
      }) {
        if (mockCompressorCallback) {
          mockCompressorCallback(file, options);
        }
      }
    },
  };
});

import { compressImage, compressBase64 } from "./compressImage";

describe("compressImage utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompressorCallback = null;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("compressImage", () => {
    it("compresses a file successfully", async () => {
      const originalFile = new File(["test content"], "test.png", {
        type: "image/png",
      });

      const compressedBlob = new Blob(["compressed"], { type: "image/jpeg" });

      mockCompressorCallback = (_file, options) => {
        setTimeout(() => options.success?.(compressedBlob), 0);
      };

      const result = await compressImage(originalFile);

      expect(result.name).toBe("test.jpg");
      expect(result.type).toBe("image/jpeg");
    });

    it("returns original file when compression fails", async () => {
      const originalFile = new File(["test content"], "test.png", {
        type: "image/png",
      });

      mockCompressorCallback = (_file, options) => {
        setTimeout(() => options.error?.(new Error("Compression failed")), 0);
      };

      const result = await compressImage(originalFile);

      expect(result).toBe(originalFile);
      expect(console.error).toHaveBeenCalledWith(
        "[Compression] Failed:",
        expect.any(Error)
      );
    });

    it("returns original file on timeout", async () => {
      vi.useFakeTimers();

      const originalFile = new File(["test content"], "test.png", {
        type: "image/png",
      });

      // Never call success or error to trigger timeout
      mockCompressorCallback = () => {
        // Do nothing - let it timeout
      };

      const promise = compressImage(originalFile);

      // Advance time past timeout (5000ms)
      vi.advanceTimersByTime(5001);

      const result = await promise;

      expect(result).toBe(originalFile);
      expect(console.warn).toHaveBeenCalledWith(
        "[Compression] Timed out, using original"
      );

      vi.useRealTimers();
    });

    it("replaces file extension with .jpg", async () => {
      const originalFile = new File(["test"], "image.PNG", {
        type: "image/png",
      });

      const compressedBlob = new Blob(["compressed"], { type: "image/jpeg" });

      mockCompressorCallback = (_file, options) => {
        setTimeout(() => options.success?.(compressedBlob), 0);
      };

      const result = await compressImage(originalFile);

      expect(result.name).toBe("image.jpg");
    });

    it("logs compression statistics", async () => {
      // Create files with specific sizes
      const originalContent = "x".repeat(1024 * 1024); // 1MB
      const originalFile = new File([originalContent], "test.png", {
        type: "image/png",
      });

      const compressedContent = "x".repeat(512 * 1024); // 0.5MB
      const compressedBlob = new Blob([compressedContent], {
        type: "image/jpeg",
      });

      mockCompressorCallback = (_file, options) => {
        setTimeout(() => options.success?.(compressedBlob), 0);
      };

      await compressImage(originalFile);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[Compression]")
      );
    });

    it("handles file with no extension", async () => {
      const originalFile = new File(["test"], "noextension", {
        type: "image/png",
      });

      const compressedBlob = new Blob(["compressed"], { type: "image/jpeg" });

      mockCompressorCallback = (_file, options) => {
        setTimeout(() => options.success?.(compressedBlob), 0);
      };

      const result = await compressImage(originalFile);

      // Should replace everything after last dot, or just name if no dot
      expect(result.type).toBe("image/jpeg");
    });
  });

  describe("compressBase64", () => {
    it("returns original base64 when an error is thrown during parsing", async () => {
      const invalidBase64 = "not-a-valid-base64-url";

      const result = await compressBase64(invalidBase64);

      expect(result).toBe(invalidBase64);
      expect(console.error).toHaveBeenCalledWith(
        "[compressBase64] Failed, using original:",
        expect.any(Error)
      );
    });

    it("converts base64 to file and compresses", async () => {
      // Valid minimal base64 PNG
      const base64Input =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const compressedBlob = new Blob(["compressed"], { type: "image/jpeg" });

      mockCompressorCallback = (_file, options) => {
        // Verify the file was created from base64
        expect(_file.name).toBe("camera-photo.jpg");
        setTimeout(() => options.success?.(compressedBlob), 0);
      };

      // Mock FileReader
      const originalFileReader = global.FileReader;
      class MockFileReader {
        result: string | null = null;
        onloadend: (() => void) | null = null;

        readAsDataURL() {
          this.result = "data:image/jpeg;base64,Y29tcHJlc3NlZA==";
          setTimeout(() => this.onloadend?.(), 0);
        }
      }
      global.FileReader = MockFileReader as unknown as typeof FileReader;

      const result = await compressBase64(base64Input);

      expect(result).toBe("data:image/jpeg;base64,Y29tcHJlc3NlZA==");

      // Restore
      global.FileReader = originalFileReader;
    });

    it("handles jpeg mime type in base64", async () => {
      const jpegBase64 =
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==";

      const compressedBlob = new Blob(["compressed"], { type: "image/jpeg" });

      mockCompressorCallback = (_file, options) => {
        setTimeout(() => options.success?.(compressedBlob), 0);
      };

      // Mock FileReader
      const originalFileReader = global.FileReader;
      class MockFileReader {
        result: string | null = null;
        onloadend: (() => void) | null = null;

        readAsDataURL() {
          this.result = "data:image/jpeg;base64,Y29tcHJlc3NlZA==";
          setTimeout(() => this.onloadend?.(), 0);
        }
      }
      global.FileReader = MockFileReader as unknown as typeof FileReader;

      const result = await compressBase64(jpegBase64);

      expect(typeof result).toBe("string");
      expect(result).toContain("data:image/jpeg;base64");

      // Restore
      global.FileReader = originalFileReader;
    });
  });
});
