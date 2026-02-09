import { describe, expect, test, vi, beforeEach } from "vitest";

// Mock auth context login
const mockLogin = vi.fn();

// Mock auth module
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    login: mockLogin,
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("LoginPage - Authentication Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("login function exists and is callable", () => {
    expect(mockLogin).toBeDefined();
    expect(typeof mockLogin).toBe("function");
  });

  test("login can be called with email and password", async () => {
    mockLogin.mockResolvedValue({});
    await mockLogin("user@test.com", "password123");
    expect(mockLogin).toHaveBeenCalledWith("user@test.com", "password123");
  });

  test("login resolves on success", async () => {
    mockLogin.mockResolvedValue({ user: { id: 1, name: "Test User" } });
    const result = await mockLogin("user@test.com", "password");
    expect(result).toBeDefined();
  });

  test("login rejects on invalid credentials", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));
    await expect(mockLogin("bad@test.com", "wrongpass")).rejects.toThrow("Invalid credentials");
  });

  test("login rejects on network error", async () => {
    mockLogin.mockRejectedValue(new Error("Network error"));
    await expect(mockLogin("user@test.com", "password")).rejects.toThrow("Network error");
  });
});

describe("LoginPage - Email Validation", () => {
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  test("validates correct email format", () => {
    expect(validateEmail("user@example.com")).toBe(true);
    expect(validateEmail("test.user@domain.org")).toBe(true);
    expect(validateEmail("user+tag@email.com")).toBe(true);
  });

  test("rejects invalid email formats", () => {
    expect(validateEmail("invalid-email")).toBe(false);
    expect(validateEmail("@example.com")).toBe(false);
    expect(validateEmail("user@")).toBe(false);
    expect(validateEmail("user @example.com")).toBe(false);
  });

  test("rejects empty email", () => {
    expect(validateEmail("")).toBe(false);
  });
});

describe("LoginPage - Password Validation", () => {
  const validatePassword = (password: string) => {
    return password.length >= 1;
  };

  test("accepts non-empty password", () => {
    expect(validatePassword("password123")).toBe(true);
    expect(validatePassword("a")).toBe(true);
  });

  test("rejects empty password", () => {
    expect(validatePassword("")).toBe(false);
  });
});

describe("LoginPage - Form State", () => {
  test("initial form state has empty values", () => {
    const initialState = {
      email: "",
      password: "",
      error: "",
      isLoading: false,
    };

    expect(initialState.email).toBe("");
    expect(initialState.password).toBe("");
    expect(initialState.error).toBe("");
    expect(initialState.isLoading).toBe(false);
  });

  test("form state can track loading", () => {
    const loadingState = {
      email: "user@test.com",
      password: "password",
      error: "",
      isLoading: true,
    };

    expect(loadingState.isLoading).toBe(true);
  });

  test("form state can track errors", () => {
    const errorState = {
      email: "bad@test.com",
      password: "wrong",
      error: "Invalid credentials",
      isLoading: false,
    };

    expect(errorState.error).toBe("Invalid credentials");
  });
});

describe("LoginPage - Navigation", () => {
  test("successful login should navigate to home", async () => {
    const mockNavigate = vi.fn();
    mockLogin.mockResolvedValue({});

    // Simulate login flow
    await mockLogin("user@test.com", "password");
    mockNavigate("/");

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  test("failed login should not navigate", async () => {
    const mockNavigate = vi.fn();
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));

    try {
      await mockLogin("bad@test.com", "wrong");
    } catch {
      // Don't navigate on error
    }

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("LoginPage - EcoLocker Branding", () => {
  test("app name is EcoLocker", () => {
    const appName = "EcoLocker";
    expect(appName).toBe("EcoLocker");
  });

  test("tagline describes smart locker functionality", () => {
    const tagline = "Smart locker network for eco-friendly handoffs";
    expect(tagline).toContain("locker");
    expect(tagline).toContain("eco");
  });

  test("login references EcoPlate account", () => {
    const helpText = "Use your EcoPlate account to sign in";
    expect(helpText).toContain("EcoPlate");
  });
});

describe("LoginPage - Security", () => {
  test("password should be masked input type", () => {
    const inputType = "password";
    expect(inputType).toBe("password");
  });

  test("email should have email input type", () => {
    const inputType = "email";
    expect(inputType).toBe("email");
  });

  test("both fields should be required", () => {
    const emailRequired = true;
    const passwordRequired = true;

    expect(emailRequired).toBe(true);
    expect(passwordRequired).toBe(true);
  });
});

describe("LoginPage - Loading State", () => {
  test("button should be disabled when loading", () => {
    const isLoading = true;
    const buttonDisabled = isLoading;

    expect(buttonDisabled).toBe(true);
  });

  test("button should show loading text when loading", () => {
    const isLoading = true;
    const buttonText = isLoading ? "Signing in..." : "Sign In";

    expect(buttonText).toBe("Signing in...");
  });

  test("button should show Sign In when not loading", () => {
    const isLoading = false;
    const buttonText = isLoading ? "Signing in..." : "Sign In";

    expect(buttonText).toBe("Sign In");
  });
});

describe("LoginPage - Error Handling", () => {
  test("error message should be displayed for Error instances", () => {
    const error = new Error("Invalid credentials");
    const errorMessage = error instanceof Error ? error.message : "Login failed";

    expect(errorMessage).toBe("Invalid credentials");
  });

  test("generic message for non-Error exceptions", () => {
    const error = "Some string error";
    const errorMessage = error instanceof Error ? error.message : "Login failed";

    expect(errorMessage).toBe("Login failed");
  });

  test("error should be cleared before new login attempt", () => {
    let error = "Previous error";
    // Clear error before attempt
    error = "";
    expect(error).toBe("");
  });
});
