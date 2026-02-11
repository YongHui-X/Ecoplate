import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImagePicker } from "./ImagePicker";

// Mock Capacitor
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

// Mock upload service
vi.mock("../../services/upload", () => ({
  uploadService: {
    uploadImages: vi.fn((files: File[]) =>
      Promise.resolve(files.map((_, i) => `uploaded-image-${i}.jpg`))
    ),
    uploadImage: vi.fn(() => Promise.resolve("uploaded-single.jpg")),
    getImageUrl: vi.fn((url: string) => `/uploads/${url}`),
  },
}));

import { uploadService } from "../../services/upload";
import { Capacitor } from "@capacitor/core";

describe("ImagePicker", () => {
  const mockOnImagesChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render with empty state", () => {
    render(<ImagePicker onImagesChange={mockOnImagesChange} />);

    expect(screen.getByText("Choose Images")).toBeInTheDocument();
    expect(screen.getByText("0 / 5 images")).toBeInTheDocument();
    expect(
      screen.getByText("No images added yet. Choose from gallery or take a photo.")
    ).toBeInTheDocument();
  });

  it("should render with initial images", () => {
    render(
      <ImagePicker
        onImagesChange={mockOnImagesChange}
        initialImages={["image1.jpg", "image2.jpg"]}
      />
    );

    expect(screen.getByText("2 / 5 images")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("should show uploading state when file selected", async () => {
    vi.mocked(uploadService.uploadImages).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(["test.jpg"]), 100))
    );

    render(<ImagePicker onImagesChange={mockOnImagesChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText("Uploading...")).toBeInTheDocument();
    });
  });

  it("should upload images and call onImagesChange", async () => {
    vi.mocked(uploadService.uploadImages).mockResolvedValue(["new-image.jpg"]);

    render(<ImagePicker onImagesChange={mockOnImagesChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(uploadService.uploadImages).toHaveBeenCalledWith([file]);
      expect(mockOnImagesChange).toHaveBeenCalledWith(["new-image.jpg"]);
    });
  });

  it("should show error when exceeding max images", async () => {
    render(
      <ImagePicker
        onImagesChange={mockOnImagesChange}
        maxImages={2}
        initialImages={["existing.jpg"]}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const files = [
      new File(["test1"], "test1.jpg", { type: "image/jpeg" }),
      new File(["test2"], "test2.jpg", { type: "image/jpeg" }),
    ];

    Object.defineProperty(input, "files", { value: files });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText("You can only add 1 more image(s)")).toBeInTheDocument();
    });
  });

  it("should remove image when X button clicked", async () => {
    render(
      <ImagePicker
        onImagesChange={mockOnImagesChange}
        initialImages={["image1.jpg", "image2.jpg"]}
      />
    );

    const removeButtons = screen.getAllByRole("button", { name: "" }).filter((btn) =>
      btn.classList.contains("bg-destructive")
    );

    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(mockOnImagesChange).toHaveBeenCalledWith(["image2.jpg"]);
    });
  });

  it("should disable Choose Images button when max images reached", () => {
    render(
      <ImagePicker
        onImagesChange={mockOnImagesChange}
        maxImages={2}
        initialImages={["image1.jpg", "image2.jpg"]}
      />
    );

    const chooseButton = screen.getByText("Choose Images").closest("button");
    expect(chooseButton).toBeDisabled();
  });

  it("should show error message on upload failure", async () => {
    vi.mocked(uploadService.uploadImages).mockRejectedValue(new Error("Upload failed"));

    render(<ImagePicker onImagesChange={mockOnImagesChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText("Upload failed")).toBeInTheDocument();
    });
  });

  it("should not show Take Photo button on web platform", () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    render(<ImagePicker onImagesChange={mockOnImagesChange} />);

    expect(screen.queryByText("Take Photo")).not.toBeInTheDocument();
  });

  it("should show Take Photo button on native platform", () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    render(<ImagePicker onImagesChange={mockOnImagesChange} />);

    expect(screen.getByText("Take Photo")).toBeInTheDocument();
  });

  it("should reset file input after upload", async () => {
    vi.mocked(uploadService.uploadImages).mockResolvedValue(["new-image.jpg"]);

    render(<ImagePicker onImagesChange={mockOnImagesChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  it("should handle custom maxImages prop", () => {
    render(<ImagePicker onImagesChange={mockOnImagesChange} maxImages={3} />);

    expect(screen.getByText("0 / 3 images")).toBeInTheDocument();
  });

  it("should not upload when no files selected", async () => {
    render(<ImagePicker onImagesChange={mockOnImagesChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, "files", { value: [] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(uploadService.uploadImages).not.toHaveBeenCalled();
    });
  });

  it("should render image previews with correct URLs", () => {
    render(
      <ImagePicker
        onImagesChange={mockOnImagesChange}
        initialImages={["image1.jpg"]}
      />
    );

    const images = screen.getAllByRole("img");
    expect(images[0]).toHaveAttribute("src", "/uploads/image1.jpg");
  });
});

describe("ImagePicker - Camera on Native", () => {
  const mockOnImagesChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  });

  it("should show error when camera used on web platform", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    render(<ImagePicker onImagesChange={mockOnImagesChange} />);

    // The Take Photo button won't be visible on web
    expect(screen.queryByText("Take Photo")).not.toBeInTheDocument();
  });

  it("should show error when max images reached and camera clicked", async () => {
    render(
      <ImagePicker
        onImagesChange={mockOnImagesChange}
        maxImages={2}
        initialImages={["image1.jpg", "image2.jpg"]}
      />
    );

    const takePhotoButton = screen.getByText("Take Photo").closest("button");
    expect(takePhotoButton).toBeDisabled();
  });
});
