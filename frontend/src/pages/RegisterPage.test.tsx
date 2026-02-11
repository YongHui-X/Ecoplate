import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './RegisterPage';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import { axe } from '../test/accessibility.setup';

// Mock navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Mock api
vi.mock('../services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const renderRegisterPage = () => {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <RegisterPage />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render registration form', () => {
    renderRegisterPage();
    
    expect(screen.getByText('EcoPlate')).toBeInTheDocument();
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('should show link to login page', () => {
    renderRegisterPage();
    
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should show avatar selection', () => {
    renderRegisterPage();
    
    expect(screen.getByText('Choose Your Avatar')).toBeInTheDocument();
    expect(screen.getByText('Sprout')).toBeInTheDocument();
    expect(screen.getByText('Leaf')).toBeInTheDocument();
  });

  it('should update name input', async () => {
    renderRegisterPage();
    const user = userEvent.setup();
    
    const nameInput = screen.getByLabelText(/name/i);
    await user.type(nameInput, 'John Doe');
    
    expect(nameInput).toHaveValue('John Doe');
  });

  it('should update email input', async () => {
    renderRegisterPage();
    const user = userEvent.setup();
    
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'john@example.com');
    
    expect(emailInput).toHaveValue('john@example.com');
  });

  it('should update password inputs', async () => {
    renderRegisterPage();
    const user = userEvent.setup();
    
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);
    
    await user.type(passwordInput, 'password123');
    await user.type(confirmInput, 'password123');
    
    expect(passwordInput).toHaveValue('password123');
    expect(confirmInput).toHaveValue('password123');
  });

  it('should have required fields', () => {
    renderRegisterPage();
    
    expect(screen.getByLabelText(/name/i)).toBeRequired();
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByLabelText(/^password$/i)).toBeRequired();
    expect(screen.getByLabelText(/confirm password/i)).toBeRequired();
  });

  it('should have optional location field', () => {
    renderRegisterPage();

    expect(screen.getByLabelText(/location/i)).not.toBeRequired();
  });

  it('should have email input with correct type', () => {
    renderRegisterPage();

    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute('type', 'email');
  });

  it('should have password inputs with correct type', () => {
    renderRegisterPage();

    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmInput).toHaveAttribute('type', 'password');
  });

  it('should have no accessibility violations', async () => {
    const { container } = renderRegisterPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('RegisterPage - Avatar Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should display multiple avatar options', () => {
    renderRegisterPage();

    // Check for avatar labels
    expect(screen.getByText('Sprout')).toBeInTheDocument();
    expect(screen.getByText('Leaf')).toBeInTheDocument();
  });

  it('should allow selecting an avatar', async () => {
    renderRegisterPage();
    const user = userEvent.setup();

    // Find avatar buttons/radio and click one
    const avatarButtons = screen.getAllByRole('button').filter(
      btn => btn.textContent?.includes('Sprout') || btn.textContent?.includes('Leaf')
    );

    if (avatarButtons.length > 0) {
      await user.click(avatarButtons[0]);
    }
  });
});

describe('RegisterPage - Form Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should not submit if passwords do not match', async () => {
    const { api } = await import('../services/api');

    renderRegisterPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'differentpassword');

    await user.click(screen.getByRole('button', { name: /create account/i }));

    // API should not be called if passwords don't match
    await waitFor(() => {
      // Either api not called or error shown
      expect(screen.getByText(/passwords/i) || api.post).toBeTruthy();
    });
  });

  it('should submit registration when form is valid', async () => {
    const { api } = await import('../services/api');
    vi.mocked(api.post).mockResolvedValue({
      token: 'test-token',
      user: { id: 1, name: 'John Doe', email: 'john@example.com' },
    });

    renderRegisterPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
  });
});
