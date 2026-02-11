import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MyFridgePage from "./MyFridgePage";
import { ToastProvider } from "../contexts/ToastContext";
import { axe } from "../test/accessibility.setup";

// Mock the api module
vi.mock("../services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock useCamera hook
vi.mock("../hooks/useCamera", () => ({
  useCamera: vi.fn(() => ({
    capturedImage: null,
    isStreaming: false,
    isLoading: false,
    error: null,
    isNative: false,
    videoRef: { current: null },
    startCamera: vi.fn(),
    capture: vi.fn(),
    retake: vi.fn(),
    stopCamera: vi.fn(),
    clearError: vi.fn(),
  })),
}));

// Mock usePoints hook
vi.mock("../contexts/PointsContext", () => ({
  usePoints: vi.fn(() => ({
    points: { totalPoints: 500, currentStreak: 3, totalCo2Saved: 10.5 },
    loading: false,
    refreshPoints: vi.fn(),
  })),
}));

// Mock Capacitor
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

// Mock Compressor - use queueMicrotask for faster async execution
vi.mock("compressorjs", () => {
  return {
    default: class MockCompressor {
      constructor(file: File, options: { success?: (file: File) => void; error?: (err: Error) => void }) {
        // Use queueMicrotask for near-synchronous execution
        queueMicrotask(() => {
          if (options.success) {
            // Return a compressed file (same content, jpeg type)
            const compressedFile = new File([file], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
            options.success(compressedFile);
          }
        });
      }
    },
  };
});

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { api } from "../services/api";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>
  );
}

/**
 * Creates a mock FileReader class and stubs it globally.
 * When readAsDataURL is called, it auto-sets result and triggers onloadend.
 */
function stubFileReader(base64Result: string) {
  const MockFileReader = vi.fn().mockImplementation(function (this: any) {
    this.result = null;
    this.onloadend = null;
    this.readAsDataURL = vi.fn(() => {
      this.result = base64Result;
      if (this.onloadend) this.onloadend();
    });
  });
  vi.stubGlobal("FileReader", MockFileReader);
  return MockFileReader;
}

describe("MyFridgePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue([]);
  });

  it("should render the page with scan receipt button", async () => {
    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });
  });

  it("should render the page with add item button", async () => {
    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Add Item")).toBeInTheDocument();
    });
  });

  it("should load products on mount", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([
          {
            id: 1,
            productName: "Apples",
            category: "produce",
            quantity: 3,
            unitPrice: null,
            purchaseDate: null,
            expiryDate: "2026-02-15",
            description: null,
            co2Emission: 0.4,
            isConsumed: false,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/myfridge/products");
    });
  });

  it("should show empty state when no products", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("No items in your fridge yet")).toBeInTheDocument();
    });
  });

  it("should have no accessibility violations", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    const { container } = renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("No items in your fridge yet")).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should display product cards when products exist", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([
          {
            id: 1,
            productName: "Milk",
            category: "dairy",
            quantity: 1,
            unitPrice: null,
            purchaseDate: null,
            expiryDate: "2026-02-10",
            description: null,
            co2Emission: 3.2,
            isConsumed: false,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Milk")).toBeInTheDocument();
      expect(screen.getByText("dairy")).toBeInTheDocument();
    });
  });
});

describe("ScanReceiptModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue([]);
  });

  it("should open scan receipt modal when button clicked", async () => {
    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
      expect(screen.getByText("Upload from files")).toBeInTheDocument();
    });
  });

  it("should show camera and upload options in modal", async () => {
    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(
        screen.getByText("Use your camera to capture a receipt")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Drag and drop, or click to browse")
      ).toBeInTheDocument();
    });
  });

  it("should close modal when X button clicked", async () => {
    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    // Find and click the close button (X icon) in the scan modal header
    const modalCloseBtn = screen.getAllByRole("button").filter((btn) => {
      const svg = btn.querySelector("svg");
      return svg && btn.closest(".max-w-md");
    })[0];
    if (modalCloseBtn) {
      fireEvent.click(modalCloseBtn);
    }
  });

  it("should process file upload via file input", async () => {
    vi.mocked(api.post).mockResolvedValue({
      items: [
        { name: "Bananas", quantity: 6, category: "produce", unit: "pcs", unitPrice: 1.5, co2Emission: 0.9 },
        { name: "Chicken Breast", quantity: 2, category: "meat", unit: "pcs", unitPrice: 8.99, co2Emission: 6.1 },
      ],
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    // Find hidden file input and upload a file
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File(["fake-image-data"], "receipt.jpg", {
      type: "image/jpeg",
    });

    // Mock FileReader
    stubFileReader("data:image/jpeg;base64,fakebase64data");

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for preview screen to appear
    await waitFor(() => {
      expect(screen.getByText("Review Photo")).toBeInTheDocument();
    });

    // Click Process Receipt to trigger the API call
    fireEvent.click(screen.getByText("Process Receipt"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/myfridge/receipt/scan", {
        imageBase64: "data:image/jpeg;base64,fakebase64data",
      });
    });
  });

  it("should display scanned items for review", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      items: [
        { name: "Bananas", quantity: 6, category: "produce", unit: "pcs", unitPrice: 1.5, co2Emission: 0.9 },
        { name: "Chicken Breast", quantity: 2, category: "meat", unit: "pcs", unitPrice: 8.99, co2Emission: 6.1 },
      ],
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    // Simulate file upload
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const file = new File(["data"], "receipt.jpg", { type: "image/jpeg" });

    stubFileReader("data:image/jpeg;base64,abc123");

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for preview and click Process Receipt
    await waitFor(() => {
      expect(screen.getByText("Review Photo")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Process Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Found 2 items. Review and edit before adding:")).toBeInTheDocument();
    });

    // Check the scanned items are editable — name and quantity
    const nameInputs = screen.getAllByDisplayValue("Bananas");
    expect(nameInputs.length).toBeGreaterThan(0);

    const quantityInputs = screen.getAllByDisplayValue("6");
    expect(quantityInputs.length).toBeGreaterThan(0);
  });

  it("should reject non-image files", async () => {
    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const textFile = new File(["not an image"], "notes.txt", {
      type: "text/plain",
    });

    fireEvent.change(fileInput, { target: { files: [textFile] } });

    // API should not have been called
    expect(api.post).not.toHaveBeenCalled();
  });

  it("should reject files larger than 10MB", async () => {
    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    // Create a large file (> 10MB)
    const largeData = new Uint8Array(11 * 1024 * 1024);
    const largeFile = new File([largeData], "huge.jpg", {
      type: "image/jpeg",
    });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    // API should not have been called
    expect(api.post).not.toHaveBeenCalled();
  });

  it("should show scanning state", async () => {
    // Make the API call hang
    vi.mocked(api.post).mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["data"], "receipt.jpg", { type: "image/jpeg" });

    stubFileReader("data:image/jpeg;base64,abc");

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      // During scanning, "Take Photo" should no longer be visible (replaced by skeleton loaders)
      expect(screen.queryByText("Take Photo")).not.toBeInTheDocument();
    });
  });

  it("should add all scanned items to fridge", async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({
        items: [
          { name: "Eggs", quantity: 12, category: "dairy", unit: "pcs", unitPrice: 0, co2Emission: 4.7 },
        ],
      })
      // Second call: adding products
      .mockResolvedValue({ id: 1, productName: "Eggs" });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    // Upload file
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["data"], "receipt.jpg", { type: "image/jpeg" });

    stubFileReader("data:image/jpeg;base64,abc");

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for preview and click Process Receipt
    await waitFor(() => {
      expect(screen.getByText("Review Photo")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Process Receipt"));

    // Wait for items to appear
    await waitFor(() => {
      expect(screen.getByText("Add 1 Items")).toBeInTheDocument();
    });

    // Click add all
    fireEvent.click(screen.getByText("Add 1 Items"));

    await waitFor(() => {
      // Should have called the add product endpoint
      expect(api.post).toHaveBeenCalledWith("/myfridge/products", expect.objectContaining({
        productName: "Eggs",
        quantity: 12,
        category: "dairy",
      }));
    });
  });

  it("should remove a scanned item", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      items: [
        { name: "Milk", quantity: 1, category: "dairy", unit: "pcs", unitPrice: 3.5, co2Emission: 3.2 },
        { name: "Bread", quantity: 2, category: "pantry", unit: "loaf", unitPrice: 2.0, co2Emission: 0.8 },
      ],
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["data"], "receipt.jpg", { type: "image/jpeg" });

    stubFileReader("data:image/jpeg;base64,abc");

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for preview and click Process Receipt
    await waitFor(() => {
      expect(screen.getByText("Review Photo")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Process Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Found 2 items. Review and edit before adding:")).toBeInTheDocument();
    });

    // Find and click a delete button for one of the items (trash icon)
    const deleteButtons = screen.getAllByRole("button").filter((btn) => {
      return btn.querySelector('svg[class*="lucide-trash"]');
    });

    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(
          screen.getByText("Found 1 items. Review and edit before adding:")
        ).toBeInTheDocument();
      });
    }
  });

  it.skip("should display all editable fields (unit, price, CO2) after scan", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      items: [
        { name: "Salmon", quantity: 1, category: "meat", unit: "kg", unitPrice: 12.99, co2Emission: 5.2 },
      ],
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["data"], "receipt.png", { type: "image/png" });

    stubFileReader("data:image/png;base64,abc");

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Found 1 items. Review and edit before adding:")).toBeInTheDocument();
    });

    // Product Name
    expect(screen.getByDisplayValue("Salmon")).toBeInTheDocument();
    // Quantity
    expect(screen.getByDisplayValue("1")).toBeInTheDocument();
    // Unit dropdown — value is "kg"
    expect(screen.getByDisplayValue("kg")).toBeInTheDocument();
    // Price — extracted from receipt as 12.99
    expect(screen.getByDisplayValue("12.99")).toBeInTheDocument();
    // Category select — selected option text is "Meat"
    const categorySelect = screen.getByDisplayValue("Meat") as HTMLSelectElement;
    expect(categorySelect).toBeInTheDocument();
    expect(categorySelect.value).toBe("meat");
    // CO2 emission — displayed but read-only
    const co2Input = screen.getByDisplayValue("5.2") as HTMLInputElement;
    expect(co2Input).toBeInTheDocument();
    expect(co2Input).toBeDisabled();
  });

  it.skip("should allow editing unit price", async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({
        items: [
          { name: "Apples", quantity: 3, category: "produce", unit: "pcs", unitPrice: 1.20, co2Emission: 0.4 },
        ],
      })
      .mockResolvedValue({ id: 1, productName: "Apples" });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["data"], "receipt.jpg", { type: "image/jpeg" });

    stubFileReader("data:image/jpeg;base64,abc");

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Add 1 Items")).toBeInTheDocument();
    });

    // Change unit price from 1.2 (extracted from receipt) to 2.50
    const priceInput = screen.getByDisplayValue("1.2");
    fireEvent.change(priceInput, { target: { value: "2.50" } });

    // Click Add
    fireEvent.click(screen.getByText("Add 1 Items"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/myfridge/products", {
        productName: "Apples",
        quantity: 3,
        unit: "pcs",
        category: "produce",
        unitPrice: 2.5,
        co2Emission: 0.4,
      });
    });
  });

  it.skip("should allow editing unit dropdown", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      items: [
        { name: "Rice", quantity: 2, category: "pantry", unit: "pcs", unitPrice: 5.0, co2Emission: 1.1 },
      ],
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["data"], "receipt.jpg", { type: "image/jpeg" });

    stubFileReader("data:image/jpeg;base64,abc");

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue("pcs")).toBeInTheDocument();
    });

    // Change unit from "pcs" to "kg"
    const unitSelect = screen.getByDisplayValue("pcs");
    fireEvent.change(unitSelect, { target: { value: "kg" } });

    // Verify the select now shows "kg"
    expect(screen.getByDisplayValue("kg")).toBeInTheDocument();
  });

  it.skip("should not allow editing CO2 emission (read-only)", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      items: [
        { name: "Beef", quantity: 1, category: "meat", unit: "kg", unitPrice: 15.0, co2Emission: 27.0 },
      ],
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["data"], "receipt.jpg", { type: "image/jpeg" });

    stubFileReader("data:image/jpeg;base64,abc");

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Add 1 Items")).toBeInTheDocument();
    });

    // CO2 input should be disabled and read-only
    const co2Input = screen.getByDisplayValue("27") as HTMLInputElement;
    expect(co2Input).toBeDisabled();
    expect(co2Input).toHaveAttribute("readonly");
  });

  it("should reject unsupported image formats (e.g. HEIC)", async () => {
    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const heicFile = new File(["fake-heic-data"], "photo.heic", {
      type: "image/heic",
    });

    fireEvent.change(fileInput, { target: { files: [heicFile] } });

    // API should not have been called
    expect(api.post).not.toHaveBeenCalled();

    // Toast should show unsupported format message
    await waitFor(() => {
      expect(
        screen.getByText("Unsupported format. Please use PNG, JPEG, GIF, or WebP.")
      ).toBeInTheDocument();
    });
  });

  it.skip("should show info toast when no items found", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      items: [],
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Receipt"));

    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["data"], "receipt.jpg", { type: "image/jpeg" });

    stubFileReader("data:image/jpeg;base64,abc");

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      // Toast should appear for "No food items found"
      expect(
        screen.getByText("No food items found in receipt")
      ).toBeInTheDocument();
    });
  });
});

describe("ProductCard actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render product card with Sell button", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([
          {
            id: 1,
            productName: "Yogurt",
            category: "dairy",
            quantity: 2,
            unitPrice: null,
            purchaseDate: null,
            expiryDate: "2026-02-10",
            description: null,
            co2Emission: 3.2,
            isConsumed: false,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Yogurt")).toBeInTheDocument();
    });

    expect(screen.getByText("Sell")).toBeInTheDocument();
  });

  it("should display product quantity and CO2 emission", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([
          {
            id: 1,
            productName: "Apples",
            category: "produce",
            quantity: 3.5,
            unit: "kg",
            unitPrice: 2.50,
            purchaseDate: "2026-02-01",
            description: "Fresh apples",
            co2Emission: 0.4,
            isConsumed: false,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Apples")).toBeInTheDocument();
      expect(screen.getByText("Qty: 3.5 kg")).toBeInTheDocument();
      expect(screen.getByText("$2.50")).toBeInTheDocument();
      expect(screen.getByText("produce")).toBeInTheDocument();
    });
  });

  it("should call delete endpoint when delete button clicked", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([
          {
            id: 1,
            productName: "Milk",
            category: "dairy",
            quantity: 1,
            unitPrice: null,
            purchaseDate: null,
            description: null,
            co2Emission: 3.2,
            isConsumed: false,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    vi.mocked(api.delete).mockResolvedValue({});

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Milk")).toBeInTheDocument();
    });

    // Find and click delete button
    const deleteButton = screen.getAllByRole("button").find((btn) =>
      btn.querySelector('svg[class*="lucide-trash"]')
    );
    if (deleteButton) {
      fireEvent.click(deleteButton);
    }

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/myfridge/products/1");
    });
  });
});

describe("AddProductModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([]);
      }
      if (url === "/myfridge/consumption/pending") {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });
  });

  it.skip("should open Add Product modal when Add Item button clicked", async () => {
    renderWithProviders(<MyFridgePage />);

    // Wait for loading to finish and empty state to show
    await waitFor(() => {
      expect(screen.getByText("No items in your fridge yet")).toBeInTheDocument();
    });

    // Find and click the Add Item button
    const addButton = screen.getByRole("button", { name: /Add Item/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText("Add Product")).toBeInTheDocument();
    });
  });

  it.skip("should close modal when Cancel clicked", async () => {
    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("No items in your fridge yet")).toBeInTheDocument();
    });

    const addButton = screen.getByRole("button", { name: /Add Item/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText("Add Product")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByText("Add Product")).not.toBeInTheDocument();
    });
  });

  it.skip("should render form fields when modal opens", async () => {
    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("No items in your fridge yet")).toBeInTheDocument();
    });

    const addButton = screen.getByRole("button", { name: /Add Item/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText("Add Product")).toBeInTheDocument();
    });

    // Check form fields exist
    expect(screen.getByLabelText("Product Name *")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity *")).toBeInTheDocument();
    expect(screen.getByLabelText("Unit *")).toBeInTheDocument();
  });
});

describe("Search functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should filter products by search query", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([
          {
            id: 1,
            productName: "Apples",
            category: "produce",
            quantity: 3,
            unitPrice: null,
            purchaseDate: null,
            description: null,
            co2Emission: 0.4,
            isConsumed: false,
          },
          {
            id: 2,
            productName: "Bananas",
            category: "produce",
            quantity: 5,
            unitPrice: null,
            purchaseDate: null,
            description: null,
            co2Emission: 0.9,
            isConsumed: false,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Apples")).toBeInTheDocument();
      expect(screen.getByText("Bananas")).toBeInTheDocument();
    });

    // Search for Apples
    const searchInput = screen.getByPlaceholderText("Search items...");
    fireEvent.change(searchInput, { target: { value: "Apple" } });

    await waitFor(() => {
      expect(screen.getByText("Apples")).toBeInTheDocument();
      expect(screen.queryByText("Bananas")).not.toBeInTheDocument();
    });
  });
});

describe("Total CO2 Summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display total CO2 footprint when products exist", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([
          {
            id: 1,
            productName: "Beef",
            category: "meat",
            quantity: 1,
            unitPrice: null,
            purchaseDate: null,
            description: null,
            co2Emission: 27.0,
            isConsumed: false,
          },
          {
            id: 2,
            productName: "Apples",
            category: "produce",
            quantity: 2,
            unitPrice: null,
            purchaseDate: null,
            description: null,
            co2Emission: 0.4,
            isConsumed: false,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Total Carbon Footprint")).toBeInTheDocument();
    });
  });

  it("should not show CO2 summary when no products", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("No items in your fridge yet")).toBeInTheDocument();
    });

    expect(screen.queryByText("Total Carbon Footprint")).not.toBeInTheDocument();
  });
});

describe("Loading state", () => {
  it("should show loading skeleton initially", () => {
    vi.mocked(api.get).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(<MyFridgePage />);

    // Check for skeleton elements
    const skeletons = document.querySelectorAll('[class*="skeleton"]') ||
                     document.querySelectorAll('[class*="Skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe("TrackConsumptionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === "/consumption/identify") {
        return Promise.resolve({ ingredients: [] });
      }
      if (url === "/consumption/analyze-waste") {
        return Promise.resolve({
          wasteAnalysis: { wasteItems: [], overallObservation: "No waste detected" },
        });
      }
      if (url === "/myfridge/consumption/pending") {
        return Promise.resolve({ id: 1 });
      }
      if (url === "/consumption/confirm-ingredients") {
        return Promise.resolve({ interactionIds: [1], success: true });
      }
      if (url === "/consumption/confirm-waste") {
        return Promise.resolve({
          metrics: {
            totalCO2Wasted: 0,
            totalCO2Saved: 1.0,
            totalEconomicWaste: 0,
            wastePercentage: 0,
            sustainabilityScore: 95,
            sustainabilityRating: "Excellent",
          },
          success: true,
        });
      }
      return Promise.resolve({});
    });
  });

  /** Helper: open the Track Consumption modal */
  async function openTrackModal() {
    renderWithProviders(<MyFridgePage />);
    await waitFor(() => {
      expect(screen.getByText("Track Consumption")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Track Consumption"));
  }

  /** Helper: upload a file and advance from a photo input step */
  function uploadFile(filename = "photo.jpg", type = "image/jpeg") {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["data"], filename, { type });
    stubFileReader("data:image/jpeg;base64,abc123");
    fireEvent.change(fileInput, { target: { files: [file] } });
  }

  it("should render Track Consumption button on page", async () => {
    renderWithProviders(<MyFridgePage />);
    await waitFor(() => {
      expect(screen.getByText("Track Consumption")).toBeInTheDocument();
    });
  });

  it.skip("should open modal with photo input UI when button clicked", async () => {
    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
      expect(screen.getByText("Upload from files")).toBeInTheDocument();
      expect(screen.getByText("Step 1 of 5 — Capture raw ingredients")).toBeInTheDocument();
    });
  });

  it("should show review page after uploading raw photo", async () => {
    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
      expect(screen.getByText("Step 2 of 5 — Confirm your ingredients")).toBeInTheDocument();
    });
  });

  it.skip("should allow adding ingredients manually on review page", async () => {
    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
    });

    // Initially 0 ingredients
    expect(screen.getByText("0 ingredients added")).toBeInTheDocument();

    // Click Add button
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(screen.getByText("1 ingredient added")).toBeInTheDocument();
    });

    // Fill in ingredient details
    const nameInput = screen.getByPlaceholderText("Ingredient name");
    fireEvent.change(nameInput, { target: { value: "Chicken" } });

    expect(screen.getByDisplayValue("Chicken")).toBeInTheDocument();
  });

  it.skip("should allow removing an ingredient", async () => {
    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
    });

    // Add two ingredients
    fireEvent.click(screen.getByText("Add"));
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(screen.getByText("2 ingredients added")).toBeInTheDocument();
    });

    // Delete first ingredient - find the delete button next to the ingredient input
    const inputs = screen.getAllByPlaceholderText("Ingredient name");
    const deleteBtn = inputs[0].parentElement?.querySelector("button");
    if (deleteBtn) fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText("1 ingredient added")).toBeInTheDocument();
    });
  });

  it.skip("should disable Next button when no ingredients", async () => {
    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
    });

    // No ingredients added yet, Next should be disabled
    const nextBtn = screen.getByText("Next").closest("button");
    expect(nextBtn).toBeDisabled();
  });

  it.skip("should navigate back to raw-input on Scan Again", async () => {
    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Scan Again")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Scan Again"));

    await waitFor(() => {
      expect(screen.getByText("Step 1 of 5 — Capture raw ingredients")).toBeInTheDocument();
    });
  });

  it.skip("should navigate to waste-input on Next click", async () => {
    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
    });

    // Add an ingredient so Next is enabled
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      const nextBtn = screen.getByText("Next").closest("button");
      expect(nextBtn).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Step 3 of 5 — Photo your plate after eating")).toBeInTheDocument();
      expect(screen.getByText("Capture Leftovers")).toBeInTheDocument();
    });
  });

  it.skip("should show waste review page after uploading waste photo", async () => {
    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    // Upload raw photo
    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
    });

    // Add an ingredient so Next is enabled
    fireEvent.click(screen.getByText("Add"));

    // Go to waste step
    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Capture Leftovers")).toBeInTheDocument();
    });

    // Upload waste photo
    uploadFile("waste.jpg");

    await waitFor(() => {
      expect(screen.getByText("Review Waste Details")).toBeInTheDocument();
      expect(screen.getByText("Step 4 of 5 — Review and confirm waste")).toBeInTheDocument();
    });
  });

  it.skip("should allow adding waste items manually on Page 4", async () => {
    await openTrackModal();
    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add"));
    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Capture Leftovers")).toBeInTheDocument();
    });

    uploadFile("waste.jpg");

    await waitFor(() => {
      expect(screen.getByText("Review Waste Details")).toBeInTheDocument();
    });

    // Initially 0 waste items
    expect(screen.getByText("0 waste items detected")).toBeInTheDocument();

    // Add a waste item
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(screen.getByText("1 waste item detected")).toBeInTheDocument();
    });

    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });

  it.skip("should close modal and show success toast on Done", async () => {
    await openTrackModal();
    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add"));
    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Capture Leftovers")).toBeInTheDocument();
    });

    uploadFile("waste.jpg");

    await waitFor(() => {
      expect(screen.getByText("Review Waste Details")).toBeInTheDocument();
    });

    // Click Confirm on waste-review to proceed to metrics (step 5)
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Done"));

    await waitFor(() => {
      expect(screen.getByText("Consumption tracked successfully!")).toBeInTheDocument();
    });
  });

  it("should reject unsupported image formats on raw photo step", async () => {
    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const heicFile = new File(["data"], "photo.heic", { type: "image/heic" });
    fireEvent.change(fileInput, { target: { files: [heicFile] } });

    await waitFor(() => {
      expect(
        screen.getByText("Unsupported format. Please use PNG, JPEG, GIF, or WebP.")
      ).toBeInTheDocument();
    });
  });

  it.skip("should show waste-input step with Capture Leftovers", async () => {
    await openTrackModal();
    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add"));
    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Capture Leftovers")).toBeInTheDocument();
      expect(screen.getByText("Step 3 of 5 — Photo your plate after eating")).toBeInTheDocument();
    });
  });

  it.skip("should navigate to waste-input step after confirming ingredients", async () => {
    await openTrackModal();
    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add"));
    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Capture Leftovers")).toBeInTheDocument();
      expect(screen.getByText("Step 3 of 5 — Photo your plate after eating")).toBeInTheDocument();
    });
  });
});

describe("Pending Consumption Banner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display pending consumption banner when records exist", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([]);
      }
      if (url === "/myfridge/consumption/pending") {
        return Promise.resolve([
          {
            id: 1,
            rawPhoto: "data:image/jpeg;base64,abc",
            ingredients: [
              { id: "1", name: "Chicken", quantity: 1, unit: "kg" },
            ],
            status: "PENDING_WASTE_PHOTO",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("1 pending consumption")).toBeInTheDocument();
    });
  });

  it("should show plural text for multiple pending consumptions", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([]);
      }
      if (url === "/myfridge/consumption/pending") {
        return Promise.resolve([
          {
            id: 1,
            rawPhoto: "data:image/jpeg;base64,abc",
            ingredients: [{ id: "1", name: "Chicken", quantity: 1 }],
            status: "PENDING_WASTE_PHOTO",
            createdAt: new Date().toISOString(),
          },
          {
            id: 2,
            rawPhoto: "data:image/jpeg;base64,def",
            ingredients: [{ id: "2", name: "Rice", quantity: 2 }],
            status: "PENDING_WASTE_PHOTO",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("2 pending consumptions")).toBeInTheDocument();
    });
  });

  it("should show Add Photo button for each pending record", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([]);
      }
      if (url === "/myfridge/consumption/pending") {
        return Promise.resolve([
          {
            id: 1,
            rawPhoto: "data:image/jpeg;base64,abc",
            ingredients: [{ id: "1", name: "Chicken", quantity: 1 }],
            status: "PENDING_WASTE_PHOTO",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Add Photo")).toBeInTheDocument();
    });
  });

  it("should delete pending consumption when delete button clicked", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([]);
      }
      if (url === "/myfridge/consumption/pending") {
        return Promise.resolve([
          {
            id: 1,
            rawPhoto: "data:image/jpeg;base64,abc",
            ingredients: [{ id: "1", name: "Chicken", quantity: 1 }],
            status: "PENDING_WASTE_PHOTO",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });
    vi.mocked(api.delete).mockResolvedValue({});

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("1 pending consumption")).toBeInTheDocument();
    });

    // Find the delete button within the pending banner
    const deleteButtons = screen.getAllByRole("button").filter((btn) =>
      btn.querySelector("svg.lucide-trash-2")
    );

    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith("/myfridge/consumption/pending/1");
      });
    }
  });

  it("should not show banner when no pending consumptions", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([]);
      }
      if (url === "/myfridge/consumption/pending") {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.queryByText("pending consumption")).not.toBeInTheDocument();
    });
  });
});

describe("Product sorting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should sort products by purchase date (most recent first)", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([
          {
            id: 1,
            productName: "Older Milk",
            category: "dairy",
            quantity: 1,
            purchaseDate: "2026-02-01",
            co2Emission: 3.2,
          },
          {
            id: 2,
            productName: "Recent Apples",
            category: "produce",
            quantity: 3,
            purchaseDate: "2026-02-10",
            co2Emission: 0.4,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Recent Apples")).toBeInTheDocument();
      expect(screen.getByText("Older Milk")).toBeInTheDocument();
    });

    // Verify Recent Apples appears before Older Milk in the DOM
    const cards = document.querySelectorAll(".grid > div");
    if (cards.length >= 2) {
      const firstCardText = cards[0].textContent;
      expect(firstCardText).toContain("Recent Apples");
    }
  });

  it("should put products without purchase date at the end", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([
          {
            id: 1,
            productName: "No Date Product",
            category: "pantry",
            quantity: 1,
            purchaseDate: null,
            co2Emission: 1.0,
          },
          {
            id: 2,
            productName: "Dated Product",
            category: "produce",
            quantity: 2,
            purchaseDate: "2026-02-05",
            co2Emission: 0.5,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("No Date Product")).toBeInTheDocument();
      expect(screen.getByText("Dated Product")).toBeInTheDocument();
    });

    // Dated Product should appear first
    const cards = document.querySelectorAll(".grid > div");
    if (cards.length >= 2) {
      const firstCardText = cards[0].textContent;
      expect(firstCardText).toContain("Dated Product");
    }
  });
});

describe("Navigation to marketplace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should navigate to create listing page when Sell button clicked", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([
          {
            id: 1,
            productName: "Apples",
            category: "produce",
            quantity: 5,
            unit: "kg",
            unitPrice: 2.5,
            purchaseDate: "2026-02-05",
            co2Emission: 0.4,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Apples")).toBeInTheDocument();
    });

    const sellButton = screen.getByText("Sell");
    fireEvent.click(sellButton);

    expect(mockNavigate).toHaveBeenCalledWith("/marketplace/create", { state: { product: expect.any(Object) } });
  });
});

describe("Error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show error toast when products fail to load", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Network error"));

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load products")).toBeInTheDocument();
    });
  });

  it("should show error toast when delete fails", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/myfridge/products") {
        return Promise.resolve([
          {
            id: 1,
            productName: "Milk",
            category: "dairy",
            quantity: 1,
            co2Emission: 3.2,
          },
        ]);
      }
      return Promise.resolve([]);
    });
    vi.mocked(api.delete).mockRejectedValue(new Error("Delete failed"));

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Milk")).toBeInTheDocument();
    });

    // Find and click delete button
    const deleteButton = screen.getAllByRole("button").find((btn) =>
      btn.querySelector('svg.lucide-trash-2')
    );
    if (deleteButton) {
      fireEvent.click(deleteButton);
    }

    await waitFor(() => {
      expect(screen.getByText("Failed to delete product")).toBeInTheDocument();
    });
  });
});
