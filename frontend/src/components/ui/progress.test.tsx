import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Progress } from './progress';

describe('Progress', () => {
  it('should render with default classes', () => {
    const { container } = render(<Progress value={50} />);
    const root = container.firstChild;
    expect(root).toHaveClass('relative');
    expect(root).toHaveClass('h-2');
    expect(root).toHaveClass('rounded-full');
  });

  it('should apply custom className', () => {
    const { container } = render(<Progress value={50} className="h-4" />);
    expect(container.firstChild).toHaveClass('h-4');
  });

  it('should show correct progress with value', () => {
    const { container } = render(<Progress value={75} />);
    const indicator = container.querySelector('[style]');
    expect(indicator).toHaveStyle({ transform: 'translateX(-25%)' });
  });

  it('should handle 0 value', () => {
    const { container } = render(<Progress value={0} />);
    const indicator = container.querySelector('[style]');
    expect(indicator).toHaveStyle({ transform: 'translateX(-100%)' });
  });

  it('should handle 100 value', () => {
    const { container } = render(<Progress value={100} />);
    const indicator = container.querySelector('[style]');
    expect(indicator).toHaveStyle({ transform: 'translateX(-0%)' });
  });

  it('should handle undefined value as 0', () => {
    const { container } = render(<Progress />);
    const indicator = container.querySelector('[style]');
    expect(indicator).toHaveStyle({ transform: 'translateX(-100%)' });
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(<Progress ref={ref} value={50} />);
    expect(ref.current).toBeTruthy();
  });
});
