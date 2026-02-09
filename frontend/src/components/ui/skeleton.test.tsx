import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton, SkeletonCard, SkeletonListItem, SkeletonProductCard } from './skeleton';

describe('Skeleton components', () => {
  describe('Skeleton', () => {
    it('should render with skeleton class', () => {
      const { container } = render(<Skeleton />);
      expect(container.firstChild).toHaveClass('skeleton');
    });

    it('should apply custom className', () => {
      const { container } = render(<Skeleton className="h-4 w-full" />);
      expect(container.firstChild).toHaveClass('skeleton');
      expect(container.firstChild).toHaveClass('h-4');
      expect(container.firstChild).toHaveClass('w-full');
    });
  });

  describe('SkeletonCard', () => {
    it('should render card skeleton with multiple skeleton elements', () => {
      const { container } = render(<SkeletonCard />);
      const skeletons = container.querySelectorAll('.skeleton');
      expect(skeletons.length).toBe(3);
    });

    it('should have card styling', () => {
      const { container } = render(<SkeletonCard />);
      expect(container.firstChild).toHaveClass('bg-card');
      expect(container.firstChild).toHaveClass('rounded-xl');
    });
  });

  describe('SkeletonListItem', () => {
    it('should render list item skeleton with multiple skeleton elements', () => {
      const { container } = render(<SkeletonListItem />);
      const skeletons = container.querySelectorAll('.skeleton');
      expect(skeletons.length).toBe(3);
    });

    it('should have flex layout', () => {
      const { container } = render(<SkeletonListItem />);
      expect(container.firstChild).toHaveClass('flex');
      expect(container.firstChild).toHaveClass('items-center');
    });
  });

  describe('SkeletonProductCard', () => {
    it('should render product card skeleton with multiple skeleton elements', () => {
      const { container } = render(<SkeletonProductCard />);
      const skeletons = container.querySelectorAll('.skeleton');
      expect(skeletons.length).toBe(4);
    });

    it('should have aspect-video skeleton for image', () => {
      const { container } = render(<SkeletonProductCard />);
      const imageArea = container.querySelector('.aspect-video');
      expect(imageArea).toBeInTheDocument();
    });
  });
});
