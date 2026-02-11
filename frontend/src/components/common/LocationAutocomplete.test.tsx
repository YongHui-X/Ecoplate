import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LocationAutocomplete } from "./LocationAutocomplete";

// Mock the googleMaps utility module
vi.mock("../../utils/googleMaps", () => ({
  loadGoogleMapsScript: vi.fn(() => Promise.resolve()),
  isGoogleMapsConfigured: vi.fn(() => true),
}));

// Mock Google Places predictions
const mockPredictions = [
  {
    place_id: "place1",
    description: "123 Orchard Road, Singapore 238840",
    structured_formatting: {
      main_text: "123 Orchard Road",
      secondary_text: "Singapore 238840",
    },
  },
  {
    place_id: "place2",
    description: "Marina Bay Sands, Singapore 018956",
    structured_formatting: {
      main_text: "Marina Bay Sands",
      secondary_text: "Singapore 018956",
    },
  },
];

// Mock place details
const mockPlaceDetails = {
  formatted_address: "123 Orchard Road, Singapore 238840",
  geometry: {
    location: {
      lat: () => 1.3048,
      lng: () => 103.8318,
    },
  },
};

describe("LocationAutocomplete", () => {
  const mockOnChange = vi.fn();
  let mockGetPlacePredictions: ReturnType<typeof vi.fn>;
  let mockGetDetails: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    // Mock Google Maps API key
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY = "test-api-key";
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Create mock functions for Google Places API
    mockGetPlacePredictions = vi.fn((request, callback) => {
      callback(mockPredictions, "OK");
    });

    mockGetDetails = vi.fn((request, callback) => {
      callback(mockPlaceDetails, "OK");
    });

    // Setup Google Maps mock - must use function() not arrow function for constructors
    (window as any).google = {
      maps: {
        places: {
          AutocompleteService: vi.fn(function() {
            return { getPlacePredictions: mockGetPlacePredictions };
          }),
          PlacesService: vi.fn(function() {
            return { getDetails: mockGetDetails };
          }),
          PlacesServiceStatus: {
            OK: "OK",
          },
        },
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render with default placeholder", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).toBeInTheDocument();
    });
  });

  it("should render with custom placeholder", async () => {
    render(
      <LocationAutocomplete
        value=""
        onChange={mockOnChange}
        placeholder="Custom placeholder"
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Custom placeholder")).toBeInTheDocument();
    });
  });

  it("should render with label", async () => {
    render(
      <LocationAutocomplete value="" onChange={mockOnChange} label="Pickup Location" />
    );

    await waitFor(() => {
      expect(screen.getByText("Pickup Location")).toBeInTheDocument();
    });
  });

  it("should render required indicator when required", async () => {
    render(
      <LocationAutocomplete
        value=""
        onChange={mockOnChange}
        label="Location"
        required
      />
    );

    await waitFor(() => {
      expect(screen.getByText("*")).toBeInTheDocument();
    });
  });

  it("should call onChange when input changes", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard" } });

    expect(mockOnChange).toHaveBeenCalledWith("Orchard");
  });

  it("should display helper text", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(
        screen.getByText("Start typing to search for Singapore addresses or landmarks")
      ).toBeInTheDocument();
    });
  });

  it("should not fetch suggestions for short queries", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Or" } });

    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(mockGetPlacePredictions).not.toHaveBeenCalled();
    });
  });

  it("should fetch suggestions after debounce delay", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(mockGetPlacePredictions).toHaveBeenCalled();
    });
  });

  it("should display suggestions dropdown", async () => {
    render(<LocationAutocomplete value="Orchard" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("123 Orchard Road")).toBeInTheDocument();
      expect(screen.getByText("Marina Bay Sands")).toBeInTheDocument();
    });
  });

  it("should display secondary text in suggestions", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("Singapore 238840")).toBeInTheDocument();
    });
  });

  it("should call onChange with coordinates when suggestion selected", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("123 Orchard Road")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("123 Orchard Road").closest("button")!);

    await waitFor(() => {
      expect(mockGetDetails).toHaveBeenCalled();
      expect(mockOnChange).toHaveBeenCalledWith(
        "123 Orchard Road, Singapore 238840",
        { latitude: 1.3048, longitude: 103.8318 }
      );
    });
  });

  it("should close suggestions on escape key", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("123 Orchard Road")).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("Singapore 238840")).not.toBeInTheDocument();
    });
  });

  it("should show no results message when no suggestions found", async () => {
    mockGetPlacePredictions.mockImplementation((request, callback) => {
      callback([], "ZERO_RESULTS");
    });

    render(<LocationAutocomplete value="xyz" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "nonexistent location xyz" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(
        screen.getByText("No locations found. Try a different search term.")
      ).toBeInTheDocument();
    });
  });

  it("should show loading indicator while fetching", async () => {
    mockGetPlacePredictions.mockImplementation(() => {
      // Never call the callback to simulate loading
    });

    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });
  });

  it("should close suggestions when clicking outside", async () => {
    render(
      <div>
        <LocationAutocomplete value="" onChange={mockOnChange} />
        <button>Outside Button</button>
      </div>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("123 Orchard Road")).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByText("Outside Button"));

    await waitFor(() => {
      expect(screen.queryByText("Singapore 238840")).not.toBeInTheDocument();
    });
  });

  it("should handle fetch error gracefully", async () => {
    mockGetPlacePredictions.mockImplementation((request, callback) => {
      callback(null, "REQUEST_DENIED");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      // Should not crash and should clear suggestions
      expect(screen.queryByText("123 Orchard Road")).not.toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it("should render with controlled value", async () => {
    render(
      <LocationAutocomplete value="Test Location" onChange={mockOnChange} />
    );

    await waitFor(() => {
      const input = screen.getByPlaceholderText("Enter pickup location");
      expect(input).toHaveValue("Test Location");
    });
  });
});

describe("LocationAutocomplete - Keyboard Navigation", () => {
  const mockOnChange = vi.fn();
  let mockGetPlacePredictions: ReturnType<typeof vi.fn>;
  let mockGetDetails: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockGetPlacePredictions = vi.fn((request, callback) => {
      callback(mockPredictions, "OK");
    });

    mockGetDetails = vi.fn((request, callback) => {
      callback(mockPlaceDetails, "OK");
    });

    // Must use function() not arrow function for constructors
    (window as any).google = {
      maps: {
        places: {
          AutocompleteService: vi.fn(function() {
            return { getPlacePredictions: mockGetPlacePredictions };
          }),
          PlacesService: vi.fn(function() {
            return { getDetails: mockGetDetails };
          }),
          PlacesServiceStatus: {
            OK: "OK",
          },
        },
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should navigate down with ArrowDown key", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("123 Orchard Road")).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });

    // First suggestion should be highlighted
    const firstSuggestion = screen.getByText("123 Orchard Road").closest("button");
    expect(firstSuggestion).toHaveClass("bg-primary/5");
  });

  it("should navigate up with ArrowUp key", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("123 Orchard Road")).toBeInTheDocument();
    });

    // Navigate down twice
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // Navigate up once
    fireEvent.keyDown(input, { key: "ArrowUp" });

    const firstSuggestion = screen.getByText("123 Orchard Road").closest("button");
    expect(firstSuggestion).toHaveClass("bg-primary/5");
  });

  it("should select suggestion with Enter key", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("123 Orchard Road")).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockGetDetails).toHaveBeenCalled();
    });
  });

  it("should show suggestions when input focused with existing suggestions", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter pickup location")).not.toBeDisabled();
    });

    const input = screen.getByPlaceholderText("Enter pickup location");

    // Type to fetch suggestions
    fireEvent.change(input, { target: { value: "Orchard Road" } });
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("123 Orchard Road")).toBeInTheDocument();
    });

    // Close suggestions
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("Singapore 238840")).not.toBeInTheDocument();
    });

    // Focus input again
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByText("123 Orchard Road")).toBeInTheDocument();
    });
  });
});
