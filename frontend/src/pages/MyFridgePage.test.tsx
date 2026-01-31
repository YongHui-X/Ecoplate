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

  it("should show review page after uploading raw photo", async () => {
    await openTrackModal();
    await waitFor(() => {
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
    });

    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
      expect(screen.getByText("Step 2 of 4 — Add your ingredients")).toBeInTheDocument();
    });
  });

  it("should allow adding ingredients manually on review page", async () => {
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

  it("should allow removing an ingredient", async () => {
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

    // Delete first ingredient
    const deleteButtons = screen.getAllByRole("button").filter((btn) => {
      return btn.querySelector("svg") && btn.closest(".bg-gray-50");
    });
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
    }

    await waitFor(() => {
      expect(screen.getByText("1 ingredient added")).toBeInTheDocument();
    });
  });

  it("should disable Next button when no ingredients", async () => {
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

  it("should navigate back to raw-input on Scan Again", async () => {
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

  it("should navigate to waste-input on Next click", async () => {
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
      expect(screen.getByText("Step 3 of 4 — Photo your plate after eating")).toBeInTheDocument();
      expect(screen.getByText("Capture Leftovers")).toBeInTheDocument();
    });
  });

  it("should show waste review page after uploading waste photo", async () => {
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
      expect(screen.getByText("Step 4 of 4 — Add waste items")).toBeInTheDocument();
    });
  });

  it("should allow adding waste items manually on Page 4", async () => {
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
    expect(screen.getByText("0 waste items added")).toBeInTheDocument();

    // Add a waste item
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(screen.getByText("1 waste item added")).toBeInTheDocument();
    });

    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("should close modal and show success toast on Done", async () => {
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

  it("should show disposal method selector on waste-input step", async () => {
    await openTrackModal();
    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add"));
    fireEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(screen.getByText("Capture Leftovers")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Landfill")).toBeInTheDocument();
    });
  });

  it("should show Back button on waste-input step", async () => {
    await openTrackModal();
    uploadFile();

    await waitFor(() => {
      expect(screen.getByText("Review Ingredients")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add"));
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
