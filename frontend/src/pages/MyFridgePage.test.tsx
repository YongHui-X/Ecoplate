import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MyFridgePage from "./MyFridgePage";
import { ToastProvider } from "../contexts/ToastContext";

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

// Mock Capacitor
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

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
    vi.mocked(api.get).mockResolvedValue([
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

  it("should display product cards when products exist", async () => {
    vi.mocked(api.get).mockResolvedValue([
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

    // Simulate file upload that triggers scan
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const file = new File(["data"], "receipt.jpg", { type: "image/jpeg" });

    stubFileReader("data:image/jpeg;base64,abc123");

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Found 2 items. Review and edit before adding:")).toBeInTheDocument();
    });

    // Check the scanned items are editable — name and quantity
    const nameInputs = screen.getAllByDisplayValue("Bananas");
    expect(nameInputs.length).toBeGreaterThan(0);

    const quantityInputs = screen.getAllByDisplayValue("6");
    expect(quantityInputs.length).toBeGreaterThan(0);

    // Verify new fields: unit dropdown, price input, CO2 input
    const unitSelects = screen.getAllByDisplayValue("pcs");
    expect(unitSelects.length).toBeGreaterThan(0);

    const co2Inputs = screen.getAllByDisplayValue("0.9");
    expect(co2Inputs.length).toBeGreaterThan(0);

    // Price extracted from receipt
    const priceInputs = screen.getAllByDisplayValue("1.5");
    expect(priceInputs.length).toBeGreaterThan(0);
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
      expect(screen.getByText("Scanning receipt...")).toBeInTheDocument();
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

    // Wait for items to appear
    await waitFor(() => {
      expect(screen.getByText("Add 1 Items")).toBeInTheDocument();
    });

    // Click add all
    fireEvent.click(screen.getByText("Add 1 Items"));

    await waitFor(() => {
      // Should have called the add product endpoint with productName, co2Emission, and unitPrice
      expect(api.post).toHaveBeenCalledWith("/myfridge/products", {
        productName: "Eggs",
        quantity: 12,
        category: "dairy",
        unitPrice: undefined,
        co2Emission: 4.7,
      });
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

    await waitFor(() => {
      expect(screen.getByText("Found 2 items. Review and edit before adding:")).toBeInTheDocument();
    });

    // Find and click a delete button for one of the items
    const deleteButtons = screen.getAllByRole("button").filter((btn) => {
      return btn.querySelector("svg") && btn.closest(".bg-gray-50");
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

  it("should display all editable fields (unit, price, CO2) after scan", async () => {
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

  it("should allow editing unit price", async () => {
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
        category: "produce",
        unitPrice: 2.5,
        co2Emission: 0.4,
      });
    });
  });

  it("should allow editing unit dropdown", async () => {
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

  it("should not allow editing CO2 emission (read-only)", async () => {
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

  it("should show info toast when no items found", async () => {
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

  it("should send correct consume request with type field", async () => {
    vi.mocked(api.get).mockResolvedValue([
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

    vi.mocked(api.post).mockResolvedValue({
      message: "Product interaction logged",
      pointsChange: 5,
    });

    renderWithProviders(<MyFridgePage />);

    await waitFor(() => {
      expect(screen.getByText("Yogurt")).toBeInTheDocument();
    });

    // Click Actions button
    fireEvent.click(screen.getByText("Actions"));

    // Click Consumed button
    await waitFor(() => {
      expect(screen.getByText("Consumed")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Consumed"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/myfridge/products/1/consume", {
        type: "consumed",
        quantity: 2,
      });
    });
  });
});

describe("TrackConsumptionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue([]);
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

  it("should open modal with photo input UI when button clicked", async () => {
    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
      expect(screen.getByText("Upload from files")).toBeInTheDocument();
      expect(screen.getByText("Step 1 of 4 — Capture raw ingredients")).toBeInTheDocument();
    });
  });

  it("should process raw photo upload and show review page", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      ingredients: [
        {
          productId: 1,
          name: "Chicken",
          matchedProductName: "Chicken Breast",
          estimatedQuantity: 0.5,
          category: "meat",
          unitPrice: 5.0,
          co2Emission: 9.0,
          confidence: "high",
        },
      ],
    });

    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/consumption/identify", {
        imageBase64: "data:image/jpeg;base64,abc123",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Chicken")).toBeInTheDocument();
    });
  });

  it("should display identified ingredients with editable fields", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      ingredients: [
        {
          productId: 1,
          name: "Salmon",
          matchedProductName: "Salmon Fillet",
          estimatedQuantity: 0.3,
          category: "meat",
          unitPrice: 12.0,
          co2Emission: 13.0,
          confidence: "medium",
        },
      ],
    });

    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
    });

    // Check all editable fields
    expect(screen.getByDisplayValue("Salmon")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0.3")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12")).toBeInTheDocument();
    expect(screen.getByText("Matched: Salmon Fillet")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();

    // CO2 should be disabled
    const co2Input = screen.getByDisplayValue("13") as HTMLInputElement;
    expect(co2Input).toBeDisabled();
  });

  it("should allow removing an ingredient", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      ingredients: [
        {
          productId: 1,
          name: "Rice",
          matchedProductName: "Rice",
          estimatedQuantity: 1,
          category: "pantry",
          unitPrice: 3.0,
          co2Emission: 4.0,
          confidence: "high",
        },
        {
          productId: 2,
          name: "Eggs",
          matchedProductName: "Eggs",
          estimatedQuantity: 2,
          category: "dairy",
          unitPrice: 4.0,
          co2Emission: 4.5,
          confidence: "high",
        },
      ],
    });

    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Found 2 ingredients. Review and edit:")).toBeInTheDocument();
    });

    // Delete first ingredient
    const deleteButtons = screen.getAllByRole("button").filter((btn) => {
      return btn.querySelector("svg") && btn.closest(".bg-gray-50");
    });
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
    }

    await waitFor(() => {
      expect(screen.getByText("Found 1 ingredient. Review and edit:")).toBeInTheDocument();
    });
  });

  it("should disable Next button when no ingredients", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      ingredients: [
        {
          productId: 1,
          name: "Tofu",
          matchedProductName: "Tofu",
          estimatedQuantity: 1,
          category: "other",
          unitPrice: 2.0,
          co2Emission: 3.0,
          confidence: "high",
        },
      ],
    });

    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    // Remove the only ingredient
    const deleteButtons = screen.getAllByRole("button").filter((btn) => {
      return btn.querySelector("svg") && btn.closest(".bg-gray-50");
    });
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
    }

    await waitFor(() => {
      const nextBtn = screen.getByText("Next").closest("button");
      expect(nextBtn).toBeDisabled();
    });
  });

  it("should navigate back to raw-input on Scan Again", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      ingredients: [
        {
          productId: 1,
          name: "Beef",
          matchedProductName: "Beef",
          estimatedQuantity: 1,
          category: "meat",
          unitPrice: 15.0,
          co2Emission: 99.0,
          confidence: "high",
        },
      ],
    });

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
      expect(screen.getByText("Step 1 of 4 — Capture raw ingredients")).toBeInTheDocument();
    });
  });

  it("should show processing state while identifying ingredients", async () => {
    vi.mocked(api.post).mockImplementation(() => new Promise(() => {}));

    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Identifying ingredients...")).toBeInTheDocument();
    });
  });

  it("should show error toast on API failure", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Network error"));

    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Failed to identify ingredients")).toBeInTheDocument();
    });
  });

  it("should navigate to waste-input on Next click", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      ingredients: [
        {
          productId: 1,
          name: "Chicken",
          matchedProductName: "Chicken Breast",
          estimatedQuantity: 0.5,
          category: "meat",
          unitPrice: 5.0,
          co2Emission: 9.0,
          confidence: "high",
        },
      ],
    });

    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Step 3 of 4 — Photo your plate after eating")).toBeInTheDocument();
      expect(screen.getByText("Capture Leftovers")).toBeInTheDocument();
    });
  });

  it("should call analyze-waste API with correct payload on waste photo upload", async () => {
    // First call: identify ingredients
    vi.mocked(api.post)
      .mockResolvedValueOnce({
        ingredients: [
          {
            productId: 1,
            name: "Chicken",
            matchedProductName: "Chicken Breast",
            estimatedQuantity: 0.5,
            category: "meat",
            unitPrice: 5.0,
            co2Emission: 9.0,
            confidence: "high",
          },
        ],
      })
      // Second call: analyze waste
      .mockResolvedValueOnce({
        metrics: {
          totalCO2Wasted: 0.9,
          totalCO2Saved: 3.6,
          disposalCO2: 0.05,
          totalEconomicWaste: 1.0,
          totalEconomicConsumed: 4.0,
          wastePercentage: 20,
          sustainabilityScore: 15,
          sustainabilityRating: "Excellent",
          itemBreakdown: [],
        },
        wasteAnalysis: {
          wasteItems: [],
          overallObservation: "Minimal waste",
        },
      });

    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    // Upload raw photo
    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    // Go to waste step
    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Capture Leftovers")).toBeInTheDocument();
    });

    // Upload waste photo
    uploadFile("waste.jpg");

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/consumption/analyze-waste", {
        imageBase64: "data:image/jpeg;base64,abc123",
        ingredients: [
          {
            productId: 1,
            productName: "Chicken Breast",
            quantityUsed: 0.5,
            category: "meat",
            unitPrice: 5.0,
            co2Emission: 9.0,
          },
        ],
        disposalMethod: "landfill",
      });
    });
  });

  it("should display waste analysis results on Page 4", async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({
        ingredients: [
          {
            productId: 1,
            name: "Chicken",
            matchedProductName: "Chicken Breast",
            estimatedQuantity: 0.5,
            category: "meat",
            unitPrice: 5.0,
            co2Emission: 9.0,
            confidence: "high",
          },
        ],
      })
      .mockResolvedValueOnce({
        metrics: {
          totalCO2Wasted: 0.9,
          totalCO2Saved: 3.6,
          disposalCO2: 0.05,
          totalEconomicWaste: 1.0,
          totalEconomicConsumed: 4.0,
          wastePercentage: 20,
          sustainabilityScore: 15,
          sustainabilityRating: "Excellent",
          itemBreakdown: [
            {
              productId: 1,
              productName: "Chicken Breast",
              quantityUsed: 0.5,
              quantityWasted: 0.1,
              co2Wasted: 0.9,
              co2Saved: 3.6,
              economicWaste: 1.0,
              emissionFactor: 9.0,
            },
          ],
        },
        wasteAnalysis: {
          wasteItems: [{ productName: "Chicken Breast", quantityWasted: 0.1, productId: 1 }],
          overallObservation: "Very little waste detected",
        },
      });

    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Capture Leftovers")).toBeInTheDocument();
    });

    uploadFile("waste.jpg");

    await waitFor(() => {
      expect(screen.getByText("Consumption Summary")).toBeInTheDocument();
    });

    // Check metrics display
    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(screen.getByText("3.6 kg")).toBeInTheDocument(); // CO2 Saved
    expect(screen.getByText("0.9 kg")).toBeInTheDocument(); // CO2 Wasted
    expect(screen.getByText("20%")).toBeInTheDocument(); // Waste %
    expect(screen.getByText("$1.00")).toBeInTheDocument(); // Economic Waste
    expect(screen.getByText("Very little waste detected")).toBeInTheDocument();
    expect(screen.getByText("Chicken Breast")).toBeInTheDocument(); // Item breakdown
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("should close modal and show success toast on Done", async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({
        ingredients: [
          {
            productId: 1,
            name: "Rice",
            matchedProductName: "Rice",
            estimatedQuantity: 1,
            category: "pantry",
            unitPrice: 3.0,
            co2Emission: 4.0,
            confidence: "high",
          },
        ],
      })
      .mockResolvedValueOnce({
        metrics: {
          totalCO2Wasted: 0,
          totalCO2Saved: 4.0,
          disposalCO2: 0,
          totalEconomicWaste: 0,
          totalEconomicConsumed: 3.0,
          wastePercentage: 0,
          sustainabilityScore: 0,
          sustainabilityRating: "Excellent",
          itemBreakdown: [],
        },
        wasteAnalysis: {
          wasteItems: [],
          overallObservation: "No waste detected",
        },
      });

    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Capture Leftovers")).toBeInTheDocument();
    });

    uploadFile("waste.jpg");

    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Done"));

    await waitFor(() => {
      expect(screen.getByText("Consumption tracked successfully!")).toBeInTheDocument();
    });
  });

  it("should show info toast when no ingredients found", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      ingredients: [],
    });

    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("No ingredients identified in photo")).toBeInTheDocument();
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

    expect(api.post).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(
        screen.getByText("Unsupported format. Please use PNG, JPEG, GIF, or WebP.")
      ).toBeInTheDocument();
    });
  });

  it("should show disposal method selector on waste-input step", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      ingredients: [
        {
          productId: 1,
          name: "Beef",
          matchedProductName: "Beef",
          estimatedQuantity: 1,
          category: "meat",
          unitPrice: 15.0,
          co2Emission: 99.0,
          confidence: "high",
        },
      ],
    });

    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Capture Leftovers")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Landfill")).toBeInTheDocument();
    });
  });

  it("should show Back button on waste-input step", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      ingredients: [
        {
          productId: 1,
          name: "Pork",
          matchedProductName: "Pork",
          estimatedQuantity: 1,
          category: "meat",
          unitPrice: 8.0,
          co2Emission: 12.0,
          confidence: "high",
        },
      ],
    });

    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Back to ingredients")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Back to ingredients"));

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
    });
  });
});
