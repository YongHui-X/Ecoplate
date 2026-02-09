import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './ToastContext';

// Mock crypto.randomUUID
const mockUUID = vi.fn(() => 'test-uuid-123');
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: mockUUID },
});

// Test component that uses useToast
function TestComponent() {
  const { toasts, addToast, removeToast } = useToast();

  return (
    <div>
      <button onClick={() => addToast('Test message', 'success')}>Add Success</button>
      <button onClick={() => addToast('Error message', 'error')}>Add Error</button>
      <button onClick={() => addToast('Info message')}>Add Info</button>
      <div data-testid="toast-count">{toasts.length}</div>
      {toasts.map((t) => (
        <div key={t.id} data-testid={`toast-${t.id}`}>
          {t.message} - {t.type}
        </div>
      ))}
    </div>
  );
}

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUUID.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('useToast hook', () => {
    it('should throw error when used outside ToastProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useToast must be used within a ToastProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('ToastProvider', () => {
    it('should start with no toasts', () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
    });

    it('should add toast with success type', async () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(screen.getByText('Add Success'));

      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
      expect(screen.getByText(/Test message - success/)).toBeInTheDocument();
    });

    it('should add toast with error type', async () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(screen.getByText('Add Error'));

      expect(screen.getByText(/Error message - error/)).toBeInTheDocument();
    });

    it('should add toast with default info type', async () => {
      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(screen.getByText('Add Info'));

      expect(screen.getByText(/Info message - info/)).toBeInTheDocument();
    });

    it('should auto-remove toast after 5 seconds', async () => {
      vi.useRealTimers(); // Use real timers for this test

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const user = userEvent.setup();
      await user.click(screen.getByText('Add Success'));

      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

      // Wait for toast to auto-remove (5 seconds + buffer)
      await waitFor(
        () => {
          expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
        },
        { timeout: 6000 }
      );
    }, 10000);

    it('should allow multiple toasts', async () => {
      // Reset UUID mock to return unique values
      let counter = 0;
      mockUUID.mockImplementation(() => `uuid-${counter++}`);

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(screen.getByText('Add Success'));
      await user.click(screen.getByText('Add Error'));

      expect(screen.getByTestId('toast-count')).toHaveTextContent('2');
    });
  });
});
