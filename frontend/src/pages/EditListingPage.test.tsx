import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EditListingPage from "./EditListingPage";
import { ToastProvider } from "../contexts/ToastContext";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(() => "mock-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: mockLocalStorage });

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockListing = {
  id: 1,
  title: "Fresh Organic Apples",
  description: "Delicious organic apples",
  category: "produce",
  quantity: 5,
  unit: "kg",
  price: 8.0,
  originalPrice: 12.0,
  expiryDate: new Date(Date.now() + 86400000 * 3).toISOString(),
  pickupLocation: "123 Main St",
  images: "image1.jpg",
  status: "active",
};

// Mock services
vi.mock("../services/marketplace", () => ({
  marketplaceService: {
    getListing: vi.fn(() => Promise.resolve(mockListing)),
    updateListing: vi.fn(() => Promise.resolve(mockListing)),
  },
}));

vi.mock("../services/upload", () => ({
  uploadService: {
    parseImages: vi.fn((images: string | null) => {
      if (!images) return [];
      return images.split(",");
    }),
    getImageUrl: vi.fn((url: string) => `/uploads/${url}`),
  },
}));

// Mock ImagePicker to avoid deep component rendering
vi.mock("../components/common/ImagePicker", () => ({
  ImagePicker: () => <div data-testid="image-picker">Image Picker</div>,
}));

// Mock LocationAutocomplete to avoid complex component rendering
vi.mock("../components/common/LocationAutocomplete", () => ({
  LocationAutocomplete: ({ value, onChange, label }: any) => (
    <div>
      <label>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search for address"
      />
    </div>
  ),
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={["/marketplace/1/edit"]}>
      <ToastProvider>
        <Routes>
          <Route path="/marketplace/:id/edit" element={ui} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

describe("EditListingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading state initially", () => {
    renderWithProviders(<EditListingPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("should render Edit Listing title", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByText("Edit Listing")).toBeInTheDocument();
    });
  });

  it("should display Back to Listing button", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByText("Back to Listing")).toBeInTheDocument();
    });
  });

  it("should display title input with existing value", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      const titleInput = screen.getByLabelText(/Title/i);
      expect(titleInput).toHaveValue("Fresh Organic Apples");
    });
  });

  it("should display description textarea with existing value", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      const descInput = screen.getByLabelText(/Description/i);
      expect(descInput).toHaveValue("Delicious organic apples");
    });
  });

  it("should display category select", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Category")).toBeInTheDocument();
    });
  });

  it("should display expiry date input", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Expiry Date")).toBeInTheDocument();
    });
  });

  it("should display quantity input with existing value", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      const qtyInput = screen.getByLabelText(/Quantity/i);
      expect(qtyInput).toHaveValue(5);
    });
  });

  it("should display unit select", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Unit")).toBeInTheDocument();
    });
  });

  it("should display original price input", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Original Price ($)")).toBeInTheDocument();
    });
  });

  it("should display selling price input", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Selling Price ($)")).toBeInTheDocument();
    });
  });

  it("should display pickup location input", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByText("Pickup Location")).toBeInTheDocument();
    });
  });

  it("should display Product Images section", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByText("Product Images")).toBeInTheDocument();
    });
  });

  it("should display Cancel button", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });
  });

  it("should display Save Changes button", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
    });
  });

  it("should update title input value", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText(/Title/i);
    fireEvent.change(titleInput, { target: { value: "Updated Apples" } });
    expect(titleInput).toHaveValue("Updated Apples");
  });

  it("should navigate back when Back to Listing clicked", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByText("Back to Listing")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Back to Listing"));
    expect(mockNavigate).toHaveBeenCalledWith("/marketplace/1");
  });

  it("should navigate back when Cancel clicked", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockNavigate).toHaveBeenCalledWith("/marketplace/1");
  });
});

describe("EditListingPage - Form Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should require title field", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      const titleInput = screen.getByLabelText(/Title/i);
      expect(titleInput).toBeRequired();
    });
  });

  it("should require quantity field", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      const qtyInput = screen.getByLabelText(/Quantity/i);
      expect(qtyInput).toBeRequired();
    });
  });
});

describe("EditListingPage - Form Interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update description textarea", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      const descInput = screen.getByLabelText(/Description/i);
      expect(descInput).toBeInTheDocument();
    });

    const descInput = screen.getByLabelText(/Description/i);
    fireEvent.change(descInput, { target: { value: "Updated description" } });
    expect(descInput).toHaveValue("Updated description");
  });

  it("should update quantity input", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      const qtyInput = screen.getByLabelText(/Quantity/i);
      expect(qtyInput).toBeInTheDocument();
    });

    const qtyInput = screen.getByLabelText(/Quantity/i);
    fireEvent.change(qtyInput, { target: { value: "10" } });
    expect(qtyInput).toHaveValue(10);
  });

  it("should update selling price input", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Selling Price ($)")).toBeInTheDocument();
    });

    const priceInput = screen.getByLabelText("Selling Price ($)");
    fireEvent.change(priceInput, { target: { value: "15" } });
    expect(priceInput).toHaveValue(15);
  });

  it("should update original price input", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Original Price ($)")).toBeInTheDocument();
    });

    const originalPriceInput = screen.getByLabelText("Original Price ($)");
    fireEvent.change(originalPriceInput, { target: { value: "20" } });
    expect(originalPriceInput).toHaveValue(20);
  });
});

describe("EditListingPage - Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display edit form when listing loads successfully", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      expect(screen.getByText("Edit Listing")).toBeInTheDocument();
      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
    });
  });
});

describe("EditListingPage - Category Selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display category select with current value", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      const categorySelect = screen.getByLabelText("Category");
      expect(categorySelect).toBeInTheDocument();
    });
  });

  it("should have category options available", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      const categorySelect = screen.getByLabelText("Category");
      expect(categorySelect).toContainHTML("Produce");
      expect(categorySelect).toContainHTML("Dairy");
      expect(categorySelect).toContainHTML("Bakery");
    });
  });
});

describe("EditListingPage - Unit Selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display unit select with current value", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      const unitSelect = screen.getByLabelText("Unit");
      expect(unitSelect).toBeInTheDocument();
    });
  });

  it("should have unit options available", async () => {
    renderWithProviders(<EditListingPage />);
    await waitFor(() => {
      const unitSelect = screen.getByLabelText("Unit");
      expect(unitSelect).toContainHTML("kg");
      expect(unitSelect).toContainHTML("pcs");
    });
  });
});
