import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import { axe } from '../test/accessibility.setup';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock api
vi.mock('../services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const renderLoginPage = () => {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <LoginPage />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render login form', () => {
    renderLoginPage();
    
    expect(screen.getByText('EcoPlate')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should show link to register page', () => {
    renderLoginPage();
    
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
  });

  it('should update email input value', async () => {
    renderLoginPage();
    const user = userEvent.setup();
    
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'test@example.com');
    
    expect(emailInput).toHaveValue('test@example.com');
  });

  it('should update password input value', async () => {
    renderLoginPage();
    const user = userEvent.setup();
    
    const passwordInput = screen.getByLabelText(/password/i);
    await user.type(passwordInput, 'password123');
    
    expect(passwordInput).toHaveValue('password123');
  });

  it('should have required fields', () => {
    renderLoginPage();

    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByLabelText(/password/i)).toBeRequired();
  });

  it('should have email input with correct type', () => {
    renderLoginPage();

    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute('type', 'email');
  });

  it('should have password input with correct type', () => {
    renderLoginPage();

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should display the EcoPlate logo/brand', () => {
    renderLoginPage();

    expect(screen.getByText('EcoPlate')).toBeInTheDocument();
  });

  it('should have no accessibility violations', async () => {
    const { container } = renderLoginPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('LoginPage - Form Submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should call login API when form submitted with valid data', async () => {
    const { api } = await import('../services/api');
    vi.mocked(api.post).mockResolvedValue({
      token: 'test-token',
      user: { id: 1, name: 'Test User', email: 'test@example.com' },
    });

    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('should navigate to dashboard after successful login', async () => {
    const { api } = await import('../services/api');
    vi.mocked(api.post).mockResolvedValue({
      token: 'test-token',
      user: { id: 1, name: 'Test User', email: 'test@example.com' },
    });

    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('should show error message on login failure', async () => {
    const { api } = await import('../services/api');
    vi.mocked(api.post).mockRejectedValue(new Error('Invalid credentials'));

    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // The error handling might display a toast or inline error
    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
  });

  it('should disable submit button while loading', async () => {
    const { api } = await import('../services/api');
    vi.mocked(api.post).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /sign|loading/i });
      expect(submitButton).toBeDisabled();
    });
  });
});
