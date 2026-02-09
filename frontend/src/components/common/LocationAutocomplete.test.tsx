import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocationAutocomplete } from "./LocationAutocomplete";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSuggestions = [
  {
    display_name: "123 Orchard Road, Singapore",
    lat: "1.3048",
    lon: "103.8318",
    address: {
      road: "Orchard Road",
      neighbourhood: "Orchard",
      postcode: "238840",
    },
  },
  {
    display_name: "456 Marina Bay, Singapore",
    lat: "1.2789",
    lon: "103.8536",
    address: {
      road: "Marina Bay Sands",
      suburb: "Marina Bay",
      postcode: "018956",
    },
  },
];

describe("LocationAutocomplete", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuggestions),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render with default placeholder", () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText("Enter pickup location")).toBeInTheDocument();
  });

  it("should render with custom placeholder", () => {
    render(
      <LocationAutocomplete
        value=""
        onChange={mockOnChange}
        placeholder="Custom placeholder"
      />
    );

    expect(screen.getByPlaceholderText("Custom placeholder")).toBeInTheDocument();
  });

  it("should render with label", () => {
    render(
      <LocationAutocomplete value="" onChange={mockOnChange} label="Pickup Location" />
    );

    expect(screen.getByText("Pickup Location")).toBeInTheDocument();
  });

  it("should render required indicator when required", () => {
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

  it("should display helper text", () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    expect(
      screen.getByText("Start typing to search for Singapore addresses, postal codes, or landmarks")
    ).toBeInTheDocument();
  });

  it("should not fetch suggestions for short queries", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Or" } });

    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  it("should fetch suggestions after debounce delay", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("nominatim.openstreetmap.org"),
        expect.any(Object)
      );
    });
  });

  it("should display suggestions dropdown", async () => {
    render(<LocationAutocomplete value="Orchard" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText(/Orchard Road/)).toBeInTheDocument();
      expect(screen.getByText(/Marina Bay Sands/)).toBeInTheDocument();
    });
  });

  it("should display postal code in suggestions", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText("Postal Code: 238840")).toBeInTheDocument();
    });
  });

  it("should call onChange with coordinates when suggestion selected", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText(/Orchard Road/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Orchard Road/).closest("button")!);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.stringContaining("Orchard"),
      { latitude: 1.3048, longitude: 103.8318 }
    );
  });

  it("should close suggestions on escape key", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText(/Orchard Road/)).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText(/Postal Code: 238840/)).not.toBeInTheDocument();
    });
  });

  it("should show no results message when no suggestions found", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

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
    mockFetch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve(mockSuggestions),
      }), 500))
    );

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
      expect(screen.getByText(/Orchard Road/)).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByText("Outside Button"));

    await waitFor(() => {
      expect(screen.queryByText(/Postal Code: 238840/)).not.toBeInTheDocument();
    });
  });

  it("should handle fetch error gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it("should render with controlled value", () => {
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
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuggestions),
    });
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
      expect(screen.getByText(/Orchard Road/)).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });

    // First suggestion should be highlighted
    const firstSuggestion = screen.getByText(/Orchard Road/).closest("button");
    expect(firstSuggestion).toHaveClass("bg-primary/5");
  });

  it("should navigate up with ArrowUp key", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText(/Orchard Road/)).toBeInTheDocument();
    });

    // Navigate down twice
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // Navigate up once
    fireEvent.keyDown(input, { key: "ArrowUp" });

    const firstSuggestion = screen.getByText(/Orchard Road/).closest("button");
    expect(firstSuggestion).toHaveClass("bg-primary/5");
  });

  it("should select suggestion with Enter key", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");
    fireEvent.change(input, { target: { value: "Orchard Road" } });

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText(/Orchard Road/)).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.stringContaining("Orchard"),
      expect.objectContaining({ latitude: expect.any(Number), longitude: expect.any(Number) })
    );
  });

  it("should show suggestions when input focused with existing suggestions", async () => {
    render(<LocationAutocomplete value="" onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText("Enter pickup location");

    // Type to fetch suggestions
    fireEvent.change(input, { target: { value: "Orchard Road" } });
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByText(/Orchard Road/)).toBeInTheDocument();
    });

    // Close suggestions
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText(/Postal Code: 238840/)).not.toBeInTheDocument();
    });

    // Focus input again
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByText(/Orchard Road/)).toBeInTheDocument();
    });
  });
});
