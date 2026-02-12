import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LocationAutocomplete } from "./LocationAutocomplete";

// Mock predictions from backend
const mockPredictions = [
  {
    placeId: "place1",
    description: "123 Orchard Road, Singapore 238840",
    mainText: "123 Orchard Road",
    secondaryText: "Singapore 238840",
  },
  {
    placeId: "place2",
    description: "Marina Bay Sands, Singapore 018956",
    mainText: "Marina Bay Sands",
    secondaryText: "Singapore 018956",
  },
];

// Mock place details from backend
const mockPlaceDetails = {
  address: "123 Orchard Road, Singapore 238840",
  latitude: 1.3048,
  longitude: 103.8318,
};

// Mock the mapsService module
const mockGetAutocompleteSuggestions = vi.fn();
const mockGetPlaceDetails = vi.fn();

vi.mock("../../services/maps", () => ({
  mapsService: {
    getAutocompleteSuggestions: (...args: unknown[]) => mockGetAutocompleteSuggestions(...args),
    getPlaceDetails: (...args: unknown[]) => mockGetPlaceDetails(...args),
  },
}));

describe("LocationAutocomplete", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Default mock implementations
    mockGetAutocompleteSuggestions.mockResolvedValue(mockPredictions);
    mockGetPlaceDetails.mockResolvedValue(mockPlaceDetails);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render with default placeholder", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText("Enter pickup location")).toBeInTheDocument();
  });

  it("should render with custom placeholder", async () => {
    render(
      <LocationAutocomplete
        value=""
        onChange={mockOnChange}
        placeholder="Custom placeholder"
      />
    );

    expect(screen.getByPlaceholderText("Custom placeholder")).toBeInTheDocument();
  });

  it("should render with label", async () => {
    render(
      <LocationAutocomplete value="" onChange={mockOnChange} label="Pickup Location" />
    );

    expect(screen.getByText("Pickup Location")).toBeInTheDocument();
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

    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("should call onChange when input changes", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard" } });

    expect(mockOnChange).toHaveBeenCalledWith("Orchard");
  });

  it("should display helper text", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    expect(
      screen.getByText("Start typing to search for Singapore addresses or landmarks")
    ).toBeInTheDocument();
  });

  it("should not fetch suggestions for short queries", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Or" } });

    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(mockGetAutocompleteSuggestions).not.toHaveBeenCalled();
    });
  });

  it("should fetch suggestions after debounce delay", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    // Advance timers and flush pending promises
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(mockGetAutocompleteSuggestions).toHaveBeenCalled();
    });
  });

  it("should display suggestions dropdown", async () => {
    render(<LocationAutocomplete value="Orchard" onChange={mockOnChange} />);

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

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("Singapore 238840")).toBeInTheDocument();
    });
  });

  it("should call onChange with coordinates when suggestion selected", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("123 Orchard Road")).toBeInTheDocument();
    });

    // Use real timers for the async click handler
    vi.useRealTimers();
    fireEvent.click(screen.getByText("123 Orchard Road").closest("button")!);

    await waitFor(() => {
      expect(mockGetPlaceDetails).toHaveBeenCalledWith("place1");
      expect(mockOnChange).toHaveBeenCalledWith(
        "123 Orchard Road, Singapore 238840",
        { latitude: 1.3048, longitude: 103.8318 }
      );
    });

    // Restore fake timers for other tests
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("should close suggestions on escape key", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

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
    mockGetAutocompleteSuggestions.mockResolvedValue([]);

    render(<LocationAutocomplete value="xyz" onChange={mockOnChange} />);

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
    // Never resolve to simulate loading
    mockGetAutocompleteSuggestions.mockReturnValue(new Promise(() => {}));

    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

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
    mockGetAutocompleteSuggestions.mockRejectedValue(new Error("Network error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      // Should not crash and should show no results
      expect(screen.queryByText("123 Orchard Road")).not.toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it("should fallback to description when place details fails", async () => {
    mockGetPlaceDetails.mockRejectedValue(new Error("Network error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("123 Orchard Road")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("123 Orchard Road").closest("button")!);

    await waitFor(() => {
      // Should fallback to description without coordinates
      expect(mockOnChange).toHaveBeenCalledWith("123 Orchard Road, Singapore 238840");
    });

    consoleSpy.mockRestore();
  });

  it("should render with controlled value", async () => {
    render(
      <LocationAutocomplete value="Test Location" onChange={mockOnChange} />
    );

    const input = screen.getByPlaceholderText("Enter pickup location");
    expect(input).toHaveValue("Test Location");
  });
});

describe("LocationAutocomplete - Keyboard Navigation", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockGetAutocompleteSuggestions.mockResolvedValue(mockPredictions);
    mockGetPlaceDetails.mockResolvedValue(mockPlaceDetails);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should navigate down with ArrowDown key", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

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

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("123 Orchard Road")).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockGetPlaceDetails).toHaveBeenCalledWith("place1");
    });
  });

  it("should show suggestions when input focused with existing suggestions", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

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
