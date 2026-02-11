import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SimilarProducts } from "./SimilarProducts";
import { marketplaceService } from "../../services/marketplace";

// Mock the marketplace service
vi.mock("../../services/marketplace", () => ({
  marketplaceService: {
    getSimilarListings: vi.fn(),
  },
}));

// Mock the upload service
vi.mock("../../services/upload", () => ({
  uploadService: {
    getListingImageUrls: vi.fn((images) => images || []),
  },
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const mockListings = [
  {
    id: 1,
    title: "Fresh Apples",
    price: 5.99,
    originalPrice: 8.99,
    expiryDate: new Date(Date.now() + 3 * 86400000).toISOString(), // 3 days from now
    images: ["image1.jpg"],
    status: "active",
    sellerId: 1,
    quantity: 1,
    unit: "kg",
    category: "fruits",
    pickupLocation: "Location 1",
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: "Organic Bananas",
    price: 3.5,
    originalPrice: null,
    expiryDate: new Date(Date.now() + 1 * 86400000).toISOString(), // 1 day from now
    images: [],
    status: "active",
    sellerId: 2,
    quantity: 6,
    unit: "pieces",
    category: "fruits",
    pickupLocation: "Location 2",
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    title: "Free Vegetables",
    price: 0,
    originalPrice: null,
    expiryDate: new Date(Date.now() - 1 * 86400000).toISOString(), // Expired 1 day ago
    images: ["veg.jpg"],
    status: "active",
    sellerId: 3,
    quantity: 2,
    unit: "kg",
    category: "vegetables",
    pickupLocation: "Location 3",
    createdAt: new Date().toISOString(),
  },
];

describe("SimilarProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should display skeleton loaders while loading", async () => {
      let resolvePromise: (value: any) => void;
      vi.mocked(marketplaceService.getSimilarListings).mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      renderWithRouter(<SimilarProducts listingId={1} />);

      // Should show skeletons while loading
      const skeletons = document.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);

      // Resolve the promise
      await waitFor(() => {
        resolvePromise!({ listings: [] });
      });
    });

    it("should show section title while loading", async () => {
      vi.mocked(marketplaceService.getSimilarListings).mockReturnValue(
        new Promise(() => {}) // Never resolves
      );

      renderWithRouter(<SimilarProducts listingId={1} />);

      expect(screen.getByText("Similar Products")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("should return null when no similar products found", async () => {
      vi.mocked(marketplaceService.getSimilarListings).mockResolvedValue({
        listings: [],
      });

      const { container } = renderWithRouter(<SimilarProducts listingId={1} />);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe("With Similar Products", () => {
    beforeEach(() => {
      vi.mocked(marketplaceService.getSimilarListings).mockResolvedValue({
        listings: mockListings,
      });
    });

    it("should display similar products", async () => {
      renderWithRouter(<SimilarProducts listingId={1} />);

      await waitFor(() => {
        expect(screen.getByText("Fresh Apples")).toBeInTheDocument();
        expect(screen.getByText("Organic Bananas")).toBeInTheDocument();
        expect(screen.getByText("Free Vegetables")).toBeInTheDocument();
      });
    });

    it("should display prices correctly", async () => {
      renderWithRouter(<SimilarProducts listingId={1} />);

      await waitFor(() => {
        expect(screen.getByText("$5.99")).toBeInTheDocument();
        expect(screen.getByText("$3.50")).toBeInTheDocument();
        expect(screen.getByText("FREE")).toBeInTheDocument();
      });
    });

    it("should display discount badge when applicable", async () => {
      renderWithRouter(<SimilarProducts listingId={1} />);

      await waitFor(() => {
        // 33% off for Fresh Apples (5.99 from 8.99)
        expect(screen.getByText("33% off")).toBeInTheDocument();
      });
    });

    it("should display expiry information", async () => {
      renderWithRouter(<SimilarProducts listingId={1} />);

      await waitFor(() => {
        expect(screen.getByText("3d")).toBeInTheDocument(); // 3 days
        expect(screen.getByText("1d")).toBeInTheDocument(); // 1 day
        expect(screen.getByText("Expired")).toBeInTheDocument(); // Expired
      });
    });

    it("should show 'No image' for products without images", async () => {
      renderWithRouter(<SimilarProducts listingId={1} />);

      await waitFor(() => {
        expect(screen.getByText("No image")).toBeInTheDocument();
      });
    });

    it("should create links to product detail pages", async () => {
      renderWithRouter(<SimilarProducts listingId={1} />);

      await waitFor(() => {
        const links = screen.getAllByRole("link");
        expect(links[0]).toHaveAttribute("href", "/marketplace/1");
        expect(links[1]).toHaveAttribute("href", "/marketplace/2");
        expect(links[2]).toHaveAttribute("href", "/marketplace/3");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(marketplaceService.getSimilarListings).mockRejectedValue(
        new Error("API Error")
      );

      const { container } = renderWithRouter(<SimilarProducts listingId={1} />);

      await waitFor(() => {
        // Should return null (empty) when error occurs
        expect(container.firstChild).toBeNull();
      });

      consoleSpy.mockRestore();
    });

    it("should handle null listings in response", async () => {
      vi.mocked(marketplaceService.getSimilarListings).mockResolvedValue({
        listings: null as any,
      });

      const { container } = renderWithRouter(<SimilarProducts listingId={1} />);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe("Re-fetching", () => {
    it("should fetch new data when listingId changes", async () => {
      vi.mocked(marketplaceService.getSimilarListings).mockResolvedValue({
        listings: mockListings,
      });

      const { rerender } = renderWithRouter(<SimilarProducts listingId={1} />);

      await waitFor(() => {
        expect(marketplaceService.getSimilarListings).toHaveBeenCalledWith(1);
      });

      rerender(
        <MemoryRouter>
          <SimilarProducts listingId={2} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(marketplaceService.getSimilarListings).toHaveBeenCalledWith(2);
      });
    });
  });
});
